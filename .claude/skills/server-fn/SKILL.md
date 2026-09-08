---
name: server-fn
description: Crear o modificar un flujo formulario → servidor → base de datos en este proyecto (newsletter, reserva de cupos, cualquier formulario nuevo o endpoint de escritura). Define la capa de schemas zod compartidos, las server functions de TanStack Start, y el formulario con react-hook-form + TanStack Query + sonner. Úsala siempre antes de escribir una mutación.
---

# Flujo de datos end-to-end

Patrón único para toda escritura del sitio. Si te desvías de esta estructura,
cada formulario terminará validando distinto y el servidor confiará en datos del
cliente.

## Regla de oro

**El schema zod es la fuente de verdad y se valida DOS veces**: en el cliente
(feedback inmediato) y en el servidor (seguridad). Nunca confíes en que el
cliente ya validó — cualquiera puede llamar a la server function con `fetch`.

## Estructura de archivos

```
src/schemas/<dominio>.ts    schema zod + tipos inferidos  (importable desde cliente y servidor)
src/actions/<dominio>.ts    server functions              (el cliente las llama por RPC)
src/components/nemorphic/   el formulario
```

> **No uses `src/server/`.** La configuración de Lovable añade una regla de
> protección de imports con `files: ["**/server/**"]` y `behavior: "error"`: si un
> archivo del cliente importa algo de ahí, `npm run dev` lo tolera pero
> **`npm run build` falla** y el despliegue se cae. Por eso las server functions
> viven en `src/actions/`. Comprobado en este proyecto (2026-09-08).

Tampoco pongas lógica de servidor dentro de `src/routes/` salvo en
`loader`/`beforeLoad`.

## Las 4 capas

### 1. Schema (`src/schemas/newsletter.ts`)

```ts
import { z } from "zod";

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo válido").max(254),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
```

- zod es **v3** (`3.25.76`) en este proyecto: usa `z.string().email()`, no la API v4.
- Mensajes de error **en español**: se muestran tal cual al usuario.
- `.trim()` y `.toLowerCase()` en el schema evitan duplicados por mayúsculas.

### 2. Server function (`src/actions/newsletter.ts`)

```ts
import { createServerFn } from "@tanstack/react-start";

import { subscribeSchema } from "@/schemas/newsletter";

export const subscribe = createServerFn({ method: "POST" })
  .validator(subscribeSchema)
  .handler(async ({ data }) => {
    // Los secretos y el cliente de Supabase se importan DENTRO del handler.
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("subscribers")
      .upsert({ email: data.email }, { onConflict: "email" });

    if (error) {
      console.error("subscribe:", error);
      return { ok: false as const, message: "No pudimos guardar tu correo. Intenta de nuevo." };
    }

    return { ok: true as const };
  });
```

Reglas duras:

- **`method: "POST"` para todo lo que escribe.** `GET` solo para lecturas.
- **`.validator(schema)`** — acepta el schema zod directo (Standard Schema).
  `.inputValidator()` existe pero está deprecado; no lo uses.
- **Todo lo que devuelvas debe ser serializable.** No devuelvas un `Error`, una
  clase, ni un objeto de Supabase crudo. Devuelve datos planos.
- **Nunca devuelvas el mensaje de error de la base al cliente**: filtra nombres de
  tablas y columnas. Loguea el detalle con `console.error` y devuelve un texto
  genérico en español.
- **`process.env` solo dentro del `.handler()`**, nunca en el nivel superior del
  módulo. Ver la skill `security` para el porqué y cómo verificarlo.
- El CSRF ya está activo para todas las server functions (`src/start.ts`), no hay
  que añadir nada.

### 3. Montar el Toaster (una sola vez)

`sonner` está en las dependencias pero **el `<Toaster />` no está montado**.
Antes del primer formulario, agrégalo en `src/routes/__root.tsx` dentro de
`RootComponent`, debajo de `<Outlet />`:

```tsx
import { Toaster } from "sonner";
// ...
<Toaster theme="dark" position="bottom-right" richColors />;
```

Nunca uses `window.alert` (es lo que hace hoy el newsletter y hay que reemplazarlo).

### 4. Formulario

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { subscribe } from "@/actions/newsletter";
import { subscribeSchema, type SubscribeInput } from "@/schemas/newsletter";

function NewsletterForm() {
  const form = useForm<SubscribeInput>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: SubscribeInput) => subscribe({ data }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("¡Listo! Te avisaremos de cada novedad.");
      form.reset();
    },
    onError: () => toast.error("Algo falló. Intenta de nuevo en un momento."),
  });

  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <input
        {...form.register("email")}
        type="email"
        className="nm-input"
        placeholder="Tu correo"
      />
      {form.formState.errors.email && <p role="alert">{form.formState.errors.email.message}</p>}
      <button type="submit" className="nm-btn nm-btn--solid" disabled={mutation.isPending}>
        {mutation.isPending ? "Enviando…" : "Suscribir"}
      </button>
    </form>
  );
}
```

- La server function se llama **`fn({ data })`**, no `fn(data)`.
- `disabled={mutation.isPending}` siempre: evita envíos dobles.
- `noValidate` en el `<form>` para que mande react-hook-form y no el navegador
  (los mensajes nativos salen en inglés y rompen el tono del sitio).
- Estilos: `nm-input`, `nm-btn`, `nm-btn--solid` ya existen. Ver skill `ui`.

## Campos dinámicos (acompañantes de una reserva)

Para "si pide más de una entrada, abrir campos para los acompañantes" usa
`useFieldArray` y sincroniza la cantidad con un `useEffect`:

```ts
const { fields, append, remove } = useFieldArray({ control: form.control, name: "guests" });
```

El schema debe validar la relación entre `tickets` y `guests` con `.superRefine()`,
para que el servidor rechace una reserva de 3 entradas que llega con 1 acompañante:

```ts
.superRefine((value, ctx) => {
  if (value.guests.length !== value.tickets - 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guests"],
      message: "Faltan datos de los acompañantes" });
  }
});
```

## Trampas de TypeScript en este repo

`tsconfig.json` tiene `strict`, `exactOptionalPropertyTypes` y
`noUncheckedIndexedAccess`:

- `array[0]` es `T | undefined` — hay que comprobarlo antes de usarlo.
- No puedes pasar `undefined` explícito a una propiedad opcional: omite la clave.
- `noPropertyAccessFromIndexSignature`: usa `obj["clave"]` en índices dinámicos.

## Checklist antes de cerrar

1. `npm run check` en verde (ver skill `check`).
2. El schema valida en cliente **y** servidor.
3. Estado de carga y de error visibles para el usuario, en español.
4. Ningún secreto ni detalle de la base filtrado en la respuesta.
5. Si el formulario es público, revisa la skill `security` (rate limiting y datos personales).
