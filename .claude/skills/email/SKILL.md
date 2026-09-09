---
name: email
description: Enviar correo desde el sitio — boletín a los suscritos, confirmación de reserva, o cualquier correo transaccional. Cubre la elección de proveedor, el adaptador de envío, la plantilla HTML con la estética Nemorphic, el envío por lotes y las obligaciones legales (baja, datos personales). Úsala antes de escribir cualquier código que mande correos.
---

# Correo

## Decisión de proveedor: lo primero es el dominio

Hoy el sitio vive en `https://nemorphic.vercel.app` y **no hay dominio propio**.
Eso es la restricción que manda, porque todos los proveedores serios exigen una
de dos cosas para dejarte enviar:

- **verificar un dominio** (registros DKIM/SPF en el DNS), o
- **verificar una única dirección remitente** (un Gmail, por ejemplo).

**Recomendación: comprar un dominio** (`nemorphic.co` o similar, ~USD 10-15 al año,
se puede comprar y apuntar desde el propio Vercel). No es un capricho estético:

- Con dominio verificado, el correo va firmado con DKIM y alineado con SPF/DMARC.
  Sin eso, enviar "en nombre de" una dirección `@gmail.com` desde un servidor de
  terceros es exactamente el patrón que los filtros de Gmail y Outlook penalizan,
  y el boletín acaba en spam.
- Un remitente `hola@nemorphic.co` da una imagen coherente con el sello; un
  `nemorphicoficial@gmail.com` no.
- Desbloquea **Resend**, que es la mejor opción de las disponibles: API muy simple,
  buen tier gratuito, endpoint de envío por lotes.

### Sin dominio, la mejor opción es el propio SMTP de Gmail

**Recomendación vigente para el tamaño actual del sello** (unas 20 personas
suscritas): enviar por el **SMTP de Gmail** con una App Password de
`nemorphictechno@gmail.com`.

Es contraintuitivo pero es lo que mejor llega: el correo lo envía Google de verdad,
así que pasa DKIM y SPF **correctamente**. Un proveedor externo mandando "en nombre
de" ese Gmail no puede alinear DKIM, y ahí es donde empiezan los problemas de spam.

- Gratis, y el límite ronda los 500 correos al día — de sobra para esta lista.
- Requiere activar la verificación en dos pasos en la cuenta para poder generar la
  App Password (`EMAIL_APP_PASSWORD`).
- Lo que **no** da: gestión de rebotes ni estadísticas de apertura. Con 20 personas
  no importa.
- Desde una función de Vercel el runtime es Node, así que se puede abrir SMTP
  (puerto 465/587). Conviene confirmarlo en el primer envío real.

**Brevo** queda como alternativa si se quiere un panel de campañas sin dominio:
permite validar una única dirección remitente. Peor alineación DKIM que la vía
anterior; confirma sus límites vigentes antes de prometerlos.

**Al comprar el dominio**, migrar a **Resend** es cambiar solo el adaptador. Y una
aclaración útil: para *enviar* desde `hola@nemorphic.co` basta verificar el dominio
con registros DNS — no hace falta buzón, ni Google Workspace, ni crear otro Gmail.
Si además se quiere *recibir* ahí, lo normal es un reenvío gratuito a la cuenta de
siempre y configurar "Enviar como" en Gmail. Las cuentas de SoundCloud e Instagram
no se ven afectadas: siguen atadas al Gmail existente.

**Formspree no sirve aquí.** Es un backend de formularios: te reenvía a ti lo que
alguien escribe. No gestiona una lista de suscriptores ni envía un boletín a
terceros. Para las reservas tampoco hace falta: eso ya lo resuelve Supabase.

### Consecuencia de diseño

Como la decisión puede cambiar (hoy Brevo, mañana Resend con dominio), **el
proveedor va detrás de un adaptador**. Cambiar de proveedor debe ser tocar un solo
archivo.

## Estructura

Nada de esto existe todavía.

```
src/lib/email/provider.ts    interfaz EmailProvider + implementación activa
src/lib/email/templates.ts   plantilla HTML del boletín y de confirmación
src/actions/newsletter.ts    server function que dispara el envío (skill server-fn)
```

Variables de entorno (solo servidor, nunca `VITE_`):

| Variable             | Para qué                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `EMAIL_FROM`         | remitente, hoy `Nemorphic <nemorphictechno@gmail.com>`            |
| `EMAIL_APP_PASSWORD` | App Password de Gmail (16 caracteres, sin espacios)               |
| `EMAIL_API_KEY`      | solo si se migra a Resend o Brevo, en vez de la App Password      |
| `SITE_URL`           | `https://nemorphic.vercel.app` — para los enlaces del correo      |

## Adaptador

```ts
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
  sendBatch(messages: ReadonlyArray<EmailMessage>): Promise<void>;
}
```

Reglas:

- **Siempre `html` y `text`.** Un correo solo-HTML puntúa peor en los filtros de spam
  y se ve roto en clientes que no cargan HTML.
- El adaptador no sabe nada del contenido; las plantillas viven aparte.

## Privacidad del envío: nunca un envío masivo con la lista visible

**Jamás** pongas todos los suscriptores en `to` ni en `cc`. Eso filtra la lista
completa de correos a cada destinatario — es una fuga de datos personales, no un
descuido estético. Incluso `bcc` masivo dispara filtros de spam.

Un correo por destinatario, o el endpoint de lotes del proveedor (que envía
mensajes individuales en una sola petición).

## Límite de tiempo en Vercel

Una server function de Vercel tiene un tope de ejecución (en el plan gratuito, del
orden de decenas de segundos). Enviar 300 correos en un bucle secuencial dentro de
una sola petición **se corta a la mitad**, y no sabrás a quién le llegó.

Diseño correcto:

1. La server function toma un **lote** (50-100 suscriptores) y devuelve cuántos
   envió y el cursor del siguiente lote.
2. El panel de admin llama en bucle mostrando una barra de progreso.
3. Registra el envío en una tabla (`campaigns` / `campaign_sends`) para poder
   reanudar y para no enviar dos veces al mismo correo.

Confirma el envío con el usuario antes de disparar el lote: un botón que manda
correos a toda la lista es irreversible.

## Obligación legal: enlace de baja

Todo correo de boletín lleva un enlace de baja visible que funcione **sin login**:

```
{SITE_URL}/baja?token={unsubscribe_token}
```

El `unsubscribe_token` es el uuid de la tabla `subscribers` (skill `db`). La ruta
marca `status = 'unsubscribed'` y muestra una confirmación. Añade también la
cabecera `List-Unsubscribe` si el proveedor lo permite.

En Colombia aplica la Ley 1581 de 2012 (habeas data): el titular puede pedir
consulta, actualización y supresión de sus datos. El enlace de baja y la
posibilidad de borrar la fila cubren lo esencial. Los correos transaccionales
(confirmación de una reserva que la persona pidió) no llevan enlace de baja.

## Plantilla: la estética Nemorphic en un cliente de correo

El correo **no puede reutilizar** `src/styles.css`. Gmail y Outlook eliminan las
hojas de estilo externas, no soportan variables CSS, y Outlook de escritorio
renderiza con el motor de Word.

Reglas de la plantilla:

- **CSS en línea** (`style="..."` en cada elemento) y layout con `<table>`.
  Nada de flexbox, grid ni `var(--nm-*)`.
- **Colores literales** copiados de los tokens: fondo `#050308`, texto `#ffffff`,
  acento `#d29ccc`, violeta `#3f1580`. Ancho máximo 600 px.
- **Tipografía**: DM Serif Display **no se carga** en la mayoría de clientes. Usa
  `font-family: Georgia, 'Times New Roman', serif` para los títulos — es el fallback
  que ya declara `--nm-font-display` y mantiene el aire editorial. Cuerpo con
  `Arial, Helvetica, sans-serif`.
- **Imagen de cabecera**: usa una imagen alojada por URL absoluta, no adjunta ni
  en base64. La mejor opción es el logo sobre fondo negro
  (`{SITE_URL}/Assets/logo%20nemorphic.png`, 100 KB) — es ligero y es la marca.
  **No uses `inicio.png` ni `seccionlanzamientos.png` tal como están: pesan 1,9 MB y
  2,9 MB.** Si se quiere una cabecera con imagen de ambiente, primero hay que
  generar una versión recortada y comprimida (≤ 200 KB, ~600×300) en
  `public/Assets/email/`.
- **Muchos clientes bloquean imágenes por defecto**: el correo tiene que entenderse
  sin ellas. `alt` en todas, y nunca metas el mensaje dentro de una imagen.
- **Modo oscuro**: un diseño ya oscuro es seguro; el riesgo es al revés. Evita texto
  oscuro sobre fondo transparente.
- Un solo llamado a la acción, con estilo de botón hecho con `<table>` y fondo
  `#3f1580` (los `<a>` con `padding` no se ven bien en Outlook).

## Contenido del boletín

El panel de admin manda **asunto** y **cuerpo** libres (el envío es manual, y sirve
para sesiones, tracks, eventos o anuncios). La plantilla es el marco: cabecera con
logo, el cuerpo que escribió el admin, y pie con redes y enlace de baja.

**Personalización**: `subscribers.name` ya se guarda (migración 0002), así que cada
correo debe encabezarse con el nombre de quien lo recibe. El cuerpo es el mismo para
todos; lo que cambia es el saludo. La columna es nullable: para quien no tenga
nombre, usa un saludo neutro en vez de dejar un hueco o escribir "null".

Si el cuerpo se escribe en texto plano, conviértelo a párrafos y **escapa el HTML**
antes de insertarlo — si no, cualquier `<` en el texto rompe el correo, y un pegado
con HTML puede inyectar contenido arbitrario.

## Verificación antes de enviar de verdad

1. Envía primero a **una** dirección propia y ábrela en Gmail (web y móvil).
2. Comprueba que el enlace de baja funciona de verdad y deja la fila en
   `unsubscribed`.
3. Revisa si cayó en spam. Si cae con dominio verificado, revisa DKIM/SPF/DMARC.
4. Solo entonces, envía a la lista — con confirmación explícita del usuario.
