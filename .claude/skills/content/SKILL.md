---
name: content
description: Añadir o editar contenido del sitio — artistas, lanzamientos de SoundCloud, eventos, textos e imágenes de la landing. Úsala cuando entre un artista nuevo al sello, se publique un track o playlist, se anuncie un evento, o haya que reemplazar una foto o un flyer.
---

# Contenido

## Dónde vive cada cosa

| Contenido           | Ubicación hoy                                       | A dónde va             |
| ------------------- | --------------------------------------------------- | ---------------------- |
| Artistas            | `src/data/nemorphic.ts` → `artistas[]`              | se queda en el archivo |
| Lanzamientos        | `src/data/nemorphic.ts` → `lanzamientos[]`          | se queda en el archivo |
| Eventos             | escritos a mano en el JSX de `src/routes/index.tsx` | migran a Supabase      |
| Textos de secciones | JSX de `src/routes/index.tsx`                       | se quedan              |
| Imágenes            | `public/Assets/`                                    | se quedan              |

Artistas y lanzamientos cambian pocas veces al año: mantenerlos en el repo es
correcto y evita infraestructura innecesaria. **Los eventos son distintos**: en
cuanto exista la reserva de cupos, cada reserva apunta a un evento y los eventos
tienen que ser filas en la base (skill `db`), editables desde el panel (skill
`admin`).

## Añadir un artista

1. Copia la foto a `public/Assets/artistas/`.
2. Añade la entrada a `artistas[]` en `src/data/nemorphic.ts`:

```ts
{
  nombre: "NOMBRE",
  imagen: "/Assets/artistas/archivo.jpg",
  descripcion: "Una o dos frases…",
  soundcloud: "https://soundcloud.com/…",
}
```

3. `npm run smoke` — si el artista debe aparecer en el render, añade su nombre al
   array `CHECKS` de `scripts/smoke.mjs`.

La landing ordena alfabéticamente sola (`artistasOrdenados`), no hace falta
insertarlo en un sitio concreto. Si falta la foto, el componente ya pinta la
inicial como respaldo (`nm-artist-initial`).

### La trampa de las mayúsculas en las extensiones

Los archivos actuales son `jlowzz.JPG`, `all.JPG`, `do.JPG`, `dstrkt.JPG` (en
mayúscula) y `blaue.jpeg`, `ectasy.jpeg` (en minúscula).

**Windows no distingue mayúsculas; el servidor de Vercel sí.** Una ruta escrita
como `/Assets/artistas/all.jpg` funciona perfectamente en local y da 404 en
producción. Copia siempre la extensión exactamente como está el archivo, y
comprueba con `ls public/Assets/artistas/` en vez de fiarte de la memoria.

Para archivos nuevos, usa minúsculas y sin espacios. (`logo nemorphic.png` lleva un
espacio por historia; en JSX hay que escribirlo `%20`.)

### Peso de las imágenes

Las fotos de cámara vienen a 4-10 MB y se muestran en tarjetas de unos cientos de
píxeles. Se reprocesaron todas (30 MB → 2,6 MB); mantén esa disciplina.

Después de copiar una imagen nueva a `public/Assets/`, pásala por el script:

```sh
node scripts/optimize-images.mjs            # informe, no escribe
node scripts/optimize-images.mjs --apply    # reprocesa y sobrescribe
```

Conserva el nombre y la extensión exactos, y auto-orienta por EXIF (sin eso, una
foto de móvil sale girada). Objetivo: por debajo de 300 KB.

## Añadir un lanzamiento

En SoundCloud: compartir → insertar → copiar la URL del `src` del iframe. Añádela a
`lanzamientos[]` respetando los parámetros del embed que ya está (color
`%236b4f8a`, `visual=true`, sin sharing ni download), para que todos los
reproductores se vean iguales.

## Añadir un evento

**Mientras no exista la base de datos**, se edita la sección `#eventos` de
`src/routes/index.tsx`: flyer, nombre, tagline y la lista `<dl>` con fecha, horario
y lugar. Mantén el `alt` del flyer descriptivo y en español — hoy describe el
evento completo, y así debe seguir.

**Cuando exista la tabla `events`**, se crea desde el panel de admin y el JSX pasa a
leer de la base. No dupliques: en cuanto migre, el evento escrito a mano se borra.

Datos mínimos de un evento: nombre, tagline, fecha y hora, lugar y dirección, flyer,
y si acepta reservas.

## Textos

- Todo en español, incluidos `alt` y `aria-label`.
- El tono es editorial y sobrio, en la línea de "Más que groove, cultura". Frases
  cortas. Sin signos de exclamación en cadena ni emoji.
- Los títulos de sección van con su `nm-eyebrow` numerado encima (`01 — …`,
  `02 — …`). Si añades una sección, continúa la numeración.

## Verificación

`npm run smoke` comprueba que el contenido clave sigue renderizando. Si añades algo
que debe aparecer siempre, súmalo a `CHECKS`. Después, `npm run check`.
