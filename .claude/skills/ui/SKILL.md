---
name: ui
description: Construir interfaz nueva en el sitio de Nemorphic — una sección, un formulario, un modal, un botón, una tarjeta. Explica el sistema visual nm-*, los tokens de color y tipografía, cuándo usar shadcn/ui y cuándo CSS propio, y las reglas de accesibilidad y responsive del proyecto. Úsala antes de escribir JSX o CSS visible.
---

# Construir interfaz

Esta skill es para **crear** UI. Para **auditar** que lo existente sigue coherente,
usa `visual-audit`.

## Dos sistemas conviven — hay que saber cuál toca

`src/styles.css` tiene dos capas de tokens:

1. **Tokens de shadcn/ui** (`--background`, `--primary`, `--border`… en `oklch`),
   que alimentan las clases de Tailwind y los 46 componentes de
   `src/components/ui/`. Están en **paleta clara**.
2. **Sistema Nemorphic** (`--nm-*`), que es lo que realmente viste la landing.

| Zona                           | Sistema                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| Landing pública (`/`)          | `nm-*` + CSS propio. Tailwind solo para utilidades sueltas (`mt-3`, `flex`) |
| Panel de admin (`/admin`)      | shadcn/ui, que para eso está (ver skill `admin`)                            |
| Modales y formularios públicos | `nm-*`                                                                      |

**No mezcles**: un `<Button>` de shadcn en medio de la landing va a desentonar
porque su paleta es clara. En la landing, `<button className="nm-btn">`.

## Tokens

```
--nm-black:        #050308   /* fondo base */
--nm-ink:          #0b0611   /* fondo de bloques */
--nm-violet-deep:  #1a0b33
--nm-violet:       #3f1580   /* acento fuerte, botones sólidos */
--nm-violet-soft:  #6a3ec0
--nm-pink:         #e9d3ec   /* títulos de modal */
--nm-pink-strong:  #d29ccc   /* eyebrow, acentos de texto */
--nm-white:        #ffffff

--nm-font-display:   "DM Serif Display", Georgia, serif
--nm-font-secondary: "Manrope", "Segoe UI", sans-serif
--nm-font-body:      var(--nm-font-secondary)
```

**Nunca escribas un color en crudo.** Si necesitas un tono que no está, añade un
token nuevo a `:root` en vez de incrustar el hex en un componente.

Las fuentes se cargan en `src/routes/__root.tsx` con un `<link>` a Google Fonts. Si
usas una familia nueva, hay que añadirla ahí **y** declarar el token. (Ojo: hoy hay
un desajuste entre lo declarado y lo cargado — ver `visual-audit`.)

## Clases disponibles

Antes de escribir CSS nuevo, mira si ya existe la pieza. Inventario de
`src/styles.css`:

- **Estructura**: `nm-container`, `nm-section`, `nm-section--about|artists|releases`,
  `nm-rule`, `nm-panel`, `nm-grain` (textura de ruido, requiere `position: relative`)
- **Tipografía**: `nm-display`, `nm-section-title`, `nm-subtitle`, `nm-eyebrow`
  (el `01 — Sección` en versalitas espaciadas), `nm-body-text`, `nm-bio`
- **Controles**: `nm-btn`, `nm-btn--solid`, `nm-input`, `nm-social`,
  `nm-inline-socials`, `nm-floating`
- **Navegación**: `nm-nav`, `nm-nav-link`, `nm-nav-link--accent`, `nm-logo-mark`
- **Modal**: `nm-modal-backdrop`, `nm-modal`, `nm-modal-close`
- **Artistas**: `nm-artist-card`, `nm-artist-img-wrap`, `nm-artist-img`,
  `nm-artist-initial`, `nm-artist-name`
- **Lanzamientos**: `nm-release-embed-shell`, `nm-release-frame`, `nm-release-title`
- **Eventos**: `nm-event-feature`, `nm-event-poster`, `nm-event-info`,
  `nm-event-title`, `nm-event-tagline`, `nm-event-details`
- **Pie**: `nm-footer` y variantes

Convención de nombres: `nm-bloque-elemento` y `nm-bloque--modificador`.

## Modales

Ya existe `src/components/nemorphic/Modal.tsx` — úsalo, no hagas otro. Gestiona
Escape, bloqueo del scroll del body, cierre al pulsar fuera, `role="dialog"`,
`aria-modal` y `aria-labelledby`.

El estado vive en `src/routes/index.tsx` como
`useState<null | "noticias" | "tienda" | "contacto">`. Para un modal nuevo (por
ejemplo, "reservar cupo"), **añade el literal a esa unión**; no montes un segundo
mecanismo de estado.

Limitación conocida: el modal no atrapa el foco (tab puede salirse al fondo). Si
metes un formulario largo dentro, arréglalo ahí en vez de duplicar el componente.

## Formularios

Marcado mínimo de un campo:

```tsx
<label htmlFor="nm-email" className="sr-only">Tu correo</label>
<input id="nm-email" name="email" type="email" className="nm-input" placeholder="Tu correo" />
```

- `label` **siempre**, aunque sea `sr-only`. Un `placeholder` no es una etiqueta.
- `id` único y `htmlFor` que coincida.
- El error va en un `<p role="alert">` junto al campo, no solo en un toast.
- Para formularios largos (reservas), etiquetas visibles, no `sr-only`.
- La lógica del formulario está en la skill `server-fn`.

## Responsive

- Móvil primero: los eventos se miran desde el teléfono.
- Breakpoints con las media queries que ya usa `styles.css`; no introduzcas una
  escala nueva.
- Nada de scroll horizontal en el `body`. Si algo se desborda (una tabla, un embed),
  que scrollee dentro de su propio contenedor.
- `nm-container` ya limita el ancho y centra: úsalo en vez de márgenes a mano.

## Accesibilidad — mínimos no negociables

- Texto en español, y también `alt` y `aria-label`.
- Imagen decorativa: `alt=""` + `aria-hidden="true"` (como el logo del botón
  flotante). Imagen con información: `alt` que describa el contenido.
- Contraste suficiente: el sistema es texto claro sobre fondo casi negro, que va
  sobrado; el riesgo es `--nm-pink-strong` sobre `--nm-violet`. Compruébalo si lo
  usas junto.
- Todo lo clicable es `<button>` o `<a>`. Nunca un `<div onClick>`.
- Foco visible: no elimines el `outline` sin poner un `:focus-visible` propio.
- Respeta `prefers-reduced-motion` en cualquier animación nueva (hay parallax en la
  sección de lanzamientos).

## Imágenes

- `loading="lazy"` y `decoding="async"` en todo lo que no esté en el hero.
- `width` y `height` explícitos para reservar espacio y evitar saltos de layout.
- Rutas bajo `/Assets/...`, respetando mayúsculas (ver skill `content`).
- Comprime antes de subir: hay 30 MB de assets sin optimizar en el repo.

## Antes de cerrar

1. `npm run check`.
2. Míralo en móvil y en escritorio.
3. Recorre el componente nuevo solo con el teclado.
4. Pasa `visual-audit` si tocaste colores, tipografía o espaciado.
