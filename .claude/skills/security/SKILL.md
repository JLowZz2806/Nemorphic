---
name: security
description: Revisar o implementar la seguridad del sitio — login del panel de admin con clave compartida, sesiones, manejo de secretos y variables de entorno, RLS de Supabase, rate limiting, protección de datos personales de suscriptores y reservas. Úsala antes de tocar autenticación, secretos o cualquier formulario público, y para auditar un cambio ya hecho.
---

# Seguridad

Este sitio guarda **datos personales de terceros** (correo, nombre, teléfono de
gente que reserva un cupo). Eso cambia el nivel de cuidado: una fuga no es un bug
del sello, es un problema para las personas que confiaron sus datos.

## 1. Autenticación del panel: una sola clave compartida

Es lo que pidió el usuario y es defendible para un grupo pequeño, pero hay que
saber qué se acepta al elegirlo:

- No hay trazabilidad: no se puede saber **quién** envió el boletín o borró algo.
- No se puede revocar a una persona: si alguien sale del grupo, **hay que cambiar la
  clave para todos**.
- Una clave compartida por WhatsApp se filtra con facilidad.

Mitigaciones obligatorias:

### Guardar un hash, no la clave

```ts
// src/lib/auth.ts — solo servidor
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Formato guardado en ADMIN_PASSWORD_HASH: "<saltHex>:<hashHex>" */
export function verifyPassword(input: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(input, Buffer.from(saltHex, "hex"), expected.length);

  // Comparación en tiempo constante: un `===` filtra la clave carácter a carácter.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}
```

El preset de Vercel genera funciones Node, así que `node:crypto` está disponible.

Para generar el hash de una clave nueva, que lo haga **el usuario** en su terminal
(así la clave nunca pasa por la conversación ni por un archivo del repo).

### Sesión sellada — no inventes un token

TanStack Start ya trae sesiones cifradas y firmadas. Úsalas:

```ts
import { useSession } from "@tanstack/react-start/server";

const sessionConfig = {
  password: process.env["SESSION_SECRET"]!, // mínimo 32 caracteres
  name: "nm_admin",
  maxAge: 60 * 60 * 8, // 8 horas
};

const session = await useSession<{ admin: true }>(sessionConfig);
await session.update({ admin: true }); // login
await session.clear(); // logout
const isAdmin = session.data.admin === true;
```

La cookie sale `httpOnly` y `secure` por defecto, y va cifrada + firmada, así que
el cliente no puede leerla ni falsificarla. `SESSION_SECRET` debe ser aleatorio y
de 32+ caracteres; si cambia, todas las sesiones caen (que es justo lo que quieres
al rotar la clave).

### Validar en cada server function

`beforeLoad` protege la navegación, **no** la API. Cada server function del panel
empieza comprobando la sesión:

```ts
export const listSubscribers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin(); // lanza si no hay sesión
  // ...
});
```

Lo ideal es un middleware compartido (`createMiddleware`) para no olvidarlo nunca.

### Rate limiting en el login

Sin límite, una clave compartida cae por fuerza bruta. Limita por IP
(`getRequestIP({ xForwardedFor: true })`, fiable detrás de Vercel) a unos pocos
intentos por minuto, con espera creciente. Guarda el contador en Supabase o en
memoria del proceso — imperfecto en serverless, pero mucho mejor que nada.

Un login fallido siempre responde lo mismo ("Clave incorrecta") y con la misma
demora, pase lo que pase.

## 2. Secretos

| Regla                                      | Detalle                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Nada de `VITE_` para secretos              | Cualquier variable con ese prefijo se inyecta en el bundle del navegador            |
| `process.env` solo dentro del `.handler()` | El código de nivel superior de un módulo puede acabar evaluado en el cliente        |
| Nunca un secreto en el repo                | `.env` está en `.gitignore` y bloqueado en `.claude/settings.json`; `.env.example` es la plantilla sin valores |
| Nunca un secreto en la conversación        | Si hace falta uno, que el usuario lo ponga en Vercel o en su `.env`                 |
| `service_role key` jamás en el cliente     | Salta RLS: quien la tenga es dueño de la base                                       |

### Comprobación real de que no se filtró nada

Después de `npm run build`, el bundle del navegador queda en `.output/public`.
Búscalo ahí:

```sh
grep -rl "SERVICE_ROLE\|eyJhbGciOi\|sk_live\|SESSION_SECRET" .output/public/ || echo "limpio"
```

Si aparece algo, hay una fuga real: mueve el acceso al secreto dentro del handler.
Haz esta comprobación cada vez que añadas una variable de entorno nueva.

## 3. Supabase

- **RLS activado en todas las tablas, sin policies.** Detalle en la skill `db`.
- Nunca construyas SQL concatenando texto. El cliente de Supabase parametriza; si
  usas `.rpc()`, tipa los argumentos.
- No devuelvas errores crudos de Postgres al cliente: filtran nombres de tablas y
  columnas. Loguea el detalle, devuelve un mensaje genérico.
- Rota la `service_role key` si alguna vez se pega en un chat, un issue o un log.

## 4. Formularios públicos

El formulario de reservas escribe en la base sin autenticación. Riesgos y respuesta:

- **Spam / bots**: rate limiting por IP, y un campo trampa (honeypot) oculto que los
  humanos nunca rellenan. Si llega relleno, responde 200 y descarta en silencio.
- **Datos inflados**: límites en el schema zod (`tickets` entre 1 y 10, longitudes
  máximas en nombre, teléfono y correo). Valida **en el servidor**, siempre.
- **Enumeración**: no digas "ese correo ya está suscrito". Responde igual siempre.
- **XSS**: React escapa por defecto. El peligro real es el HTML del boletín (skill
  `email`) y cualquier uso de `dangerouslySetInnerHTML` — no lo uses con texto que
  venga de la base.

## 5. Datos personales (Ley 1581 de 2012, Colombia)

Lo que se guarda: correo del boletín; nombre, correo, teléfono y acompañantes de
cada reserva. **La cédula se dejó fuera a propósito** — si alguna vez entra, exige
justificación explícita, acceso restringido y plazo de borrado.

Obligaciones que el código debe cumplir:

- **Minimización**: no pidas un dato que no vayas a usar.
- **Aviso en el formulario**: una línea que diga para qué se usan los datos y quién
  los guarda, antes del botón de enviar.
- **Baja del boletín** con un clic y sin login (skill `email`).
- **Supresión**: poder borrar los datos de una persona que lo pida. Un botón en el
  panel, o al menos un procedimiento escrito.
- **Retención**: las reservas de un evento pasado no tienen por qué guardarse para
  siempre. Propón un borrado periódico.
- No exportes CSV con datos personales a sitios que no controle el sello.

## 6. Al revisar un cambio, verifica

1. ¿Hay algún secreto nuevo? → comprobación del bundle, arriba.
2. ¿Se añadió una server function? → ¿valida la sesión si es del panel? ¿valida la
   entrada con zod si es pública?
3. ¿Se añadió una tabla? → ¿RLS activado?
4. ¿Se añadió un campo de datos personales? → ¿se justifica? ¿se puede borrar?
5. ¿Algún mensaje de error revela estructura interna?
6. `npm run check` en verde.

Para una revisión más amplia del diff existe el comando `/security-review`.
