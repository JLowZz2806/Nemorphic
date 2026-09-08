---
name: visual-audit
description: Auditar la coherencia visual del sitio — detectar colores o tipografías fuera del sistema, desajustes entre las fuentes declaradas y las cargadas, CSS muerto, imágenes sin optimizar, problemas de contraste, responsive o accesibilidad. Úsala después de un cambio visual grande, cada cierto tiempo como revisión de salud, o cuando algo "se ve raro" y no sabes por qué.
---

# Auditoría visual

Mientras `ui` sirve para **construir** dentro del sistema, esta skill sirve para
comprobar que el sistema **sigue siendo uno solo**. La landing se degrada de una
forma concreta: alguien mete un hex suelto, una fuente que no se carga, una clase
que ya no usa nadie. Cada cosa es inofensiva; juntas deshacen la línea visual.

## Cómo se ejecuta

Es una revisión con pasos comprobables. Recórrelos en orden y **reporta hallazgos
con archivo y línea**; no arregles nada sin decir antes qué encontraste, porque
cambiar tokens afecta a toda la página a la vez.

### 1. Colores fuera del sistema

```sh
grep -nE "#[0-9a-fA-F]{3,8}" src/styles.css | grep -v -- "--nm-"
grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/routes/ src/components/nemorphic/
```

Todo color de la landing debe salir de `var(--nm-*)`. Los `oklch()` del bloque de
shadcn son legítimos: alimentan `src/components/ui/`. Un hex incrustado en JSX o en
una regla `.nm-*` es un hallazgo.

### 2. Tipografía: declarada vs. cargada

```sh
grep -n "font-family\|--nm-font" src/styles.css
grep -n "fonts.googleapis" src/routes/__root.tsx
```

Toda familia declarada tiene que estar en el `<link>` de Google Fonts, y toda
familia cargada tiene que usarse.

> **Resuelto (2026-09-08).** `--nm-font-secondary` declaraba `"Manrope"` pero
> `__root.tsx` cargaba DM Sans, así que todo el cuerpo caía al fallback `Segoe UI`.
> Se corrigió cargando Manrope y quitando DM Sans. Ahora el smoke test comprueba
> las dos familias (`family=DM+Serif+Display` y `family=Manrope`), así que una
> desincronización futura rompe `npm run check` en vez de pasar desapercibida.

### 3. Tamaños y espaciado sueltos

```sh
grep -rn "style={{" src/routes/ src/components/nemorphic/
```

Los `style` en línea son puntos de fuga del sistema. Algunos son legítimos (el
`translate3d` del parallax, que se calcula en JS). Un `fontSize` o un `color`
literal en línea debería ser una clase.

### 4. CSS muerto

Para cada clase `.nm-*` de `styles.css`, comprueba que alguien la usa:

```sh
for c in $(grep -o "^\.nm-[a-z0-9-]*" src/styles.css | sort -u | tr -d .); do
  grep -rq "$c" src/routes/ src/components/ || echo "sin usar: $c"
done
```

CSS muerto no rompe nada, pero hace que la próxima persona no sepa qué es real.

### 5. Peso de las imágenes

```sh
ls -la public/Assets/ public/Assets/artistas/
du -sh public/Assets
```

> **Resuelto (2026-09-08).** `public/Assets/` pesaba **30 MB** (fotos de cámara sin
> procesar: `jlowzz.JPG` 10,7 MB a 6192x4128, y dos PNG fotográficos de 2-3 MB).
> Se reprocesó con `node scripts/optimize-images.mjs`: **30 MB → 2,6 MB**.
>
> Para imágenes nuevas, ese script es la herramienta: informa por defecto y escribe
> con `--apply`. Detalles importantes que ya resuelve:
>
> - **Auto-orienta por EXIF** (`.rotate()`). Cuatro fotos tenían `orientation=8`;
>   redimensionar sin auto-orientar las habría dejado giradas 90° en el navegador.
> - **Conserva el nombre y la extensión exactos** (incluido el `.JPG` en mayúscula),
>   así no rompe ninguna referencia.
> - Con `--convert-png` pasa a JPEG los PNG **sin transparencia** — y avisa de los
>   renombrados para actualizar las referencias a mano.
> - `Logo con fondo.png` está en la lista de exclusión: no lo referencia ningún
>   código y puede ser una copia maestra.

### 6. Responsive y desbordes

Con `npm run dev`, revisa a 360 px, 768 px y 1440 px:

- ¿Hay scroll horizontal en el `body`? (`overflow-x: hidden` en `body.nm-body` lo
  esconde, así que búscalo midiendo `document.body.scrollWidth`, no a ojo.)
- ¿Los embeds de SoundCloud y el flyer del evento se adaptan?
- ¿La navegación funciona en móvil?

### 7. Accesibilidad

- Contraste de `--nm-pink-strong` (#d29ccc) y `--nm-violet` (#3f1580) contra su
  fondo real. Sobre `--nm-black` van bien; el riesgo es violeta sobre violeta.
- `alt` presente y en español en todas las imágenes; `alt=""` solo en decorativas.
- Foco visible en enlaces, botones y campos.
- Nada interactivo que sea un `<div>`.
- Jerarquía de encabezados sin saltos (un solo `<h1>`, luego `<h2>`…).

### 8. Coherencia de marca

Lo que hace que el sitio se vea "Nemorphic" y hay que preservar:

- Fondo casi negro, acentos violeta y rosa empolvado. Nada de blancos amplios.
- Serif de display en títulos, sans ligera en cuerpo. Sin negritas fuertes.
- Espaciado generoso: secciones altas, `nm-rule` separando, `nm-eyebrow` numerado
  encima de cada título.
- Textura de grano (`nm-grain`) sobre los bloques.
- Movimiento sutil: parallax lento, transiciones suaves. Nada que rebote o parpadee.

Si una pantalla nueva no cumple esto, no pertenece a la landing. (El panel de admin
es la excepción declarada — ver skill `admin`.)

## Formato del informe

Agrupa por severidad:

- **Rompe la línea visual** — color o fuente fuera del sistema, componente que no
  encaja.
- **Afecta al usuario** — peso de imágenes, contraste, desbordes en móvil.
- **Deuda** — CSS muerto, estilos en línea, nombres inconsistentes.

Con archivo:línea y la corrección propuesta. Los cambios de token o de tipografía
se proponen, no se aplican solos.
