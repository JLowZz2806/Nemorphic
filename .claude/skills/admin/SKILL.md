---
name: admin
description: Trabajar en el panel de administración de Nemorphic (/admin) — login con la clave compartida, listados de suscriptores y reservas, envío manual del boletín, alta y edición de eventos. Úsala para crear el panel o para añadirle una sección nueva.
---

# Panel de administración

Herramienta interna en `/admin` para que **todo el equipo de Nemorphic, técnico o
no**, consulte y edite los datos sin entrar a Supabase.

## Estado

**Fase 1 hecha** (2026-09-08): existe `/admin` con login por clave compartida,
sesión sellada y cierre de sesión. Falta todo lo que necesita base de datos.

Archivos actuales:

```
src/lib/auth.ts                     sesión, verificación de clave, límite de intentos
src/actions/admin.ts                server functions: login, logout, getAdminStatus
src/routes/admin/login.tsx          /admin/login (fuera del layout protegido)
src/routes/admin/_panel.tsx         layout con la guarda + cabecera del panel
src/routes/admin/_panel/index.tsx   /admin (resumen)
```

`_panel` es un layout **sin segmento de URL**: envuelve lo protegido sin añadir
nada a la ruta. El login queda fuera a propósito — dentro, la redirección al login
entraría en bucle infinito.

Para añadir una sección nueva basta con crear `src/routes/admin/_panel/<nombre>.tsx`
y sumarla al array `secciones` de `_panel.tsx`; queda protegida automáticamente.

Depende además de `db` (datos), `security` (login y sesión), `server-fn`
(mutaciones) y `email` (envío).

## Principio rector: escrito para alguien que no programa

Quien lo usa no sabe qué es una tabla ni un uuid. Por tanto:

- Etiquetas en español natural: "Personas suscritas", no "subscribers".
- Fechas legibles (`date-fns` con locale `es`), no ISO 8601.
- Toda acción destructiva o irreversible pide confirmación explícita, y el texto dice
  qué va a pasar: "Se enviará un correo a 143 personas. Esto no se puede deshacer."
- Nada de ids visibles salvo que sirvan para algo (el código de reserva, sí).
- Un error nunca es un stack trace: es una frase que dice qué pasó y qué hacer.

## Estructura de rutas

```
src/routes/admin/
  route.tsx        layout protegido: valida la sesión en beforeLoad y pinta el chrome
  index.tsx        resumen
  suscriptores.tsx listado, buscador, exportar CSV, dar de baja
  reservas.tsx     reservas por evento, acompañantes, exportar CSV, check-in
  eventos.tsx      crear y editar eventos, abrir/cerrar reservas
  boletin.tsx      redactar y enviar el correo (asunto + cuerpo + previsualización)
  login.tsx        fuera del layout protegido
```

En TanStack Start el archivo `route.tsx` dentro de una carpeta es el layout de ese
segmento, y renderiza los hijos con `<Outlet />`.

## Protección

La comprobación de sesión va en el **servidor**, en `beforeLoad` del layout, y
redirige a `/admin/login` si no hay sesión. Los detalles de la sesión sellada, el
hash de la contraseña y el rate limiting están en la skill `security` — léela antes
de tocar el login.

Nunca escondas datos solo con CSS o con un `if` en el cliente: cada server function
del panel valida la sesión por su cuenta, porque cualquiera puede llamarlas
directamente.

Además, el panel entero va con `noindex`:

```tsx
head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] });
```

y `/admin` debe quedar excluido en `public/robots.txt`.

## Aspecto

El panel **no** replica la landing. La landing es una pieza editorial; el panel es
una herramienta y necesita densidad y legibilidad.

- Usa los componentes de `src/components/ui/` (shadcn): `table`, `dialog`, `input`,
  `button`, `badge`, `tabs`. Ya están instalados y son consistentes entre sí.
- Mantén el aire de marca solo en el marco: fondo oscuro (`#050308`), acento
  (`#d29ccc`) y el logo en la cabecera. Nada de grano, parallax ni serif gigante.
- Tablas legibles: alineación a la izquierda, números a la derecha, filas altas.
- Móvil: los integrantes van a mirar las reservas desde el teléfono en la puerta del
  evento. Las tablas tienen que ser usables ahí — considera tarjetas apiladas en
  pantallas pequeñas en vez de scroll horizontal.

## Secciones

### Suscriptores

Listado con buscador y contador de activos. Exportar CSV. Dar de baja manualmente.
No permitir editar el correo (si está mal, se borra y se vuelve a suscribir).

### Reservas

Agrupadas por evento, con el total de entradas comprometidas frente al aforo.
Cada reserva despliega sus acompañantes. Exportar CSV para la lista de puerta.
Botón de check-in que marca `status = 'checked_in'`.

### Boletín

Asunto, cuerpo, previsualización con la plantilla real, y envío por lotes con barra
de progreso (ver skill `email`, apartado de límite de tiempo en Vercel).
Antes de enviar: diálogo de confirmación con el número exacto de destinatarios y un
botón para enviarse una prueba a sí mismo primero.

### Eventos

Alta y edición. Al crear uno nuevo, `reservations_open` decide si el formulario
público acepta reservas. Es lo que sustituye al evento hoy escrito a mano en el JSX
de `src/routes/index.tsx` (ver skill `content`).

## Exportar CSV

Genera el CSV en el servidor y devuélvelo como `Response` con
`content-type: text/csv; charset=utf-8` y `content-disposition: attachment`.
Incluye el BOM UTF-8 (`﻿`) al principio: sin él, Excel en Windows destroza las
tildes y las ñ.

## Verificación

1. `npm run check`.
2. Con sesión cerrada, entrar a `/admin/suscriptores` redirige al login.
3. Llamar a una server function del panel sin sesión devuelve error, no datos.
4. Probar en pantalla de móvil.
5. El envío del boletín, primero a una dirección propia.
