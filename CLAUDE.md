# Nemorphic — guía de trabajo

Sitio del sello techno **Nemorphic** (español, one-page). Repo sincronizado con
Lovable; ver `AGENTS.md` antes de tocar el historial de git.

## Stack

| Pieza         | Qué se usa                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Framework     | TanStack Start 1.168 + TanStack Router 1.170 (file-based routing)                               |
| UI            | React 19, TypeScript 5.8 (`strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`) |
| Estilos       | Tailwind CSS v4 (plugin de Vite) + CSS propio en `src/styles.css` (prefijo `nm-`)               |
| Componentes   | shadcn/ui (new-york, 46 componentes en `src/components/ui/`) + Radix + lucide-react             |
| Datos/estado  | TanStack Query 5 (provider ya montado en `__root.tsx`)                                          |
| Formularios   | react-hook-form + zod + `@hookform/resolvers` (ya en deps, aún sin usar)                        |
| Toasts        | sonner (en deps, aún sin usar — preferirlo sobre `window.alert`)                                |
| Build         | Vite 8 vía `@lovable.dev/vite-tanstack-config`                                                  |
| Deploy        | Nitro preset `cloudflare-module` → Cloudflare Workers (`wrangler`)                              |
| Runtime local | Node 24 + npm (hay `bun.lock` y `bunfig.toml`, pero **bun no está instalado**: usar npm)        |

## Comandos

```sh
npm install        # node_modules no viene en el repo
npm run dev        # vite dev
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run format     # prettier --write .
npm run smoke      # levanta dev y verifica que la home renderiza (SSR) sin errores
npm run check      # typecheck + lint + smoke  ← ejecutar antes de dar por terminado un cambio
npm run build      # build de producción (Nitro/Cloudflare)

node scripts/optimize-images.mjs            # informe de peso de public/Assets
node scripts/optimize-images.mjs --apply    # reprocesa y sobrescribe
```

`npm run check` es la verificación mínima de cualquier cambio. No hay test
runner instalado; `scripts/smoke.mjs` cumple ese rol para el HTML renderizado.

Sobre el smoke test:

- Levanta `vite dev` (puerto 8080, o el siguiente libre), pide `/` y comprueba
  que el HTML de SSR trae las 5 secciones, el hero, el eslogan, los artistas del
  array, el embed de SoundCloud, el evento y el logo — y que no cayó en la página
  de error del servidor. Al terminar mata el árbol de procesos del dev server.
- Contra un servidor ya levantado: `node scripts/smoke.mjs --url http://localhost:8080`.
- Cuando agregues secciones o features (newsletter, reservas), **agrega su
  comprobación al array `CHECKS`** de `scripts/smoke.mjs`.

Notas de entorno (Windows):

- El checkout usa CRLF (`core.autocrlf=true`); por eso `.prettierrc` tiene
  `endOfLine: "auto"`. Sin eso, `npm run lint` reportaba ~5600 errores falsos.
- Quedan 6 `warning` de `react-refresh/only-export-components` en `src/components/ui/`
  (código de shadcn). Son preexistentes: el objetivo es **0 errores**, no 0 warnings.

## Mapa del proyecto

```
src/
  routes/
    __root.tsx        shell HTML, <head>, QueryClientProvider, 404 y error boundary
    index.tsx         TODA la landing (~560 líneas): nav, hero, quiénes somos,
                      artistas, lanzamientos, eventos, modales y newsletter
    admin/            panel privado: login, layout protegido `_panel` y secciones
    routeTree.gen.ts  AUTOGENERADO — no editar a mano
  components/
    nemorphic/        Modal.tsx (modal propio, no Radix) y SocialIcons.tsx (SVG inline)
    ui/               shadcn/ui — reutilizar antes de escribir un componente nuevo
  data/nemorphic.ts   artistas[] y lanzamientos[] (contenido hardcodeado + constantes LOGO/HERO_BG)
  lib/                utils.ts (cn), auth.ts (sesión del panel) y reporte de errores a Lovable
  actions/            server functions llamables desde el cliente por RPC
  schemas/            schemas zod compartidos entre cliente y servidor
  start.ts            middlewares de servidor: manejo de errores + CSRF para server functions
  server.ts           entry SSR que normaliza errores 500 tragados por h3
public/Assets/        imágenes reales (rutas con mayúscula y espacios: "/Assets/logo nemorphic.png")
```

## Convenciones

- **Routing**: solo file-based en `src/routes/`. Nada de `src/pages/` ni `app/`.
  Ver `src/routes/README.md` para la tabla de convenciones.
- **Estilos**: la landing usa clases propias `nm-*` de `src/styles.css` con las
  variables `--nm-black/--nm-violet/--nm-pink/--nm-font-display`. Mantener esa
  paleta; Tailwind se usa para utilidades puntuales, no para reescribir el diseño.
- **Idioma**: todo el texto visible y los `alt` van en español.
- **Assets**: usar siempre las rutas reales bajo `/Assets/...` (respetar mayúsculas;
  espacios como `%20` en JSX).
- **Imports**: alias `@/*` → `src/*` disponible; el código actual usa rutas relativas.
- **TS estricto**: con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`,
  indexar arrays da `T | undefined` y los opcionales no aceptan `undefined` explícito.
- **Prettier**: 100 columnas, comillas dobles. Correr `npm run format` al terminar.
- **Nunca `src/server/`**: la config de Lovable prohíbe que el cliente importe de
  `**/server/**` con `behavior: "error"`. `npm run dev` lo tolera, pero
  `npm run build` falla y el despliegue se cae. Las server functions van en
  `src/actions/`.
- **Dependencias**: `bunfig.toml` impone 24 h mínimas desde la publicación de un
  paquete. Preguntar antes de añadir una dependencia nueva.
- **Git**: no reescribir historia publicada (rebase/amend/squash/force-push) —
  rompe la sincronía con Lovable.

## Skills del proyecto

Están en `.claude/skills/`. Invócalas con `/nombre` o deja que se activen solas.
Antes de escribir código, revisa si hay una que cubra la tarea.

| Skill          | Cuándo                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| `server-fn`    | Cualquier formulario o escritura: schema zod + server function + react-hook-form + sonner |
| `db`           | Supabase: tablas, migraciones, RLS, consultas                                             |
| `email`        | Enviar correo: proveedor, plantilla, lotes, baja                                          |
| `admin`        | Panel `/admin`: login, listados, envío del boletín, eventos                               |
| `security`     | Auth, secretos, RLS, rate limiting, datos personales                                      |
| `content`      | Añadir artistas, lanzamientos, eventos, imágenes                                          |
| `ui`           | Construir interfaz nueva dentro del sistema `nm-*`                                        |
| `visual-audit` | Auditar coherencia visual, tipografía, peso de imágenes, accesibilidad                    |
| `check`        | Ejecutar e interpretar `npm run check`                                                    |

## Estado actual de lo que se va a construir

- **Newsletter**: `src/routes/index.tsx` → `handleNewsletter()` (~línea 77) hoy solo
  hace `window.alert` y limpia el formulario. No hay backend, ni base de datos, ni
  envío de correo. `sonner` está instalado pero el `<Toaster />` **no está montado**.
- **Eventos**: la sección `#eventos` tiene un único evento escrito a mano en el JSX
  (UMBRA, 3 de octubre, Épica). No hay modelo de datos de eventos ni reserva de cupos.
- **Panel de admin**: `/admin` existe con login por clave compartida, sesión sellada
  (`nm_admin`, HttpOnly + Secure + SameSite=Lax, 8 h) y límite de intentos. Sin
  `SESSION_SECRET` ni `ADMIN_PASSWORD_HASH` el panel no rompe: redirige al login y
  ahí avisa de que falta configurarlo.
- **Server functions**: aún no se usa ninguna, pero `src/start.ts` ya deja activo el
  middleware CSRF, así que las `createServerFn` quedan protegidas por defecto.

## Próximo trabajo — decisiones ya tomadas

1. **Newsletter funcional**: guardar suscriptores en Supabase y enviarles correo.
   El envío es **manual desde el panel de admin**, con asunto y cuerpo libres, para
   anunciar sesiones, tracks, eventos o comunicados.
2. **Reserva de cupos**: formulario con evento, nombre, correo, teléfono y cantidad
   de entradas; si pide más de una, se abren campos para el nombre de cada
   acompañante. Todo se guarda en Supabase.
3. **Panel de admin** en `/admin`, con una única clave compartida con el grupo, para
   que los integrantes no técnicos consulten y editen datos sin entrar a Supabase.

| Decisión          | Resuelto                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de datos     | **Supabase** (Postgres). Acceso solo desde el servidor con la clave secreta (`sb_secret_…`, en `SUPABASE_SECRET_KEY`); RLS activo y sin policies        |
| Acceso del equipo | Panel de admin en la propia página + Table Editor de Supabase como respaldo                                                                             |
| Auth del admin    | Una clave compartida. Hash en variable de entorno + sesión sellada de TanStack Start                                                                    |
| Notificaciones    | Manuales, desde el panel. Nunca automáticas                                                                                                             |
| Cédula            | **Fuera por ahora.** Se documentó cómo añadirla en el futuro si hace falta                                                                              |
| Correo            | Sin resolver: no hay dominio propio. Ver skill `email` — la recomendación es comprar dominio y usar Resend; el puente es Brevo con remitente verificado |

## Despliegue

La página está en **Vercel**: `https://nemorphic.vercel.app`.

Detalle importante: `@lovable.dev/vite-tanstack-config` pasa a Nitro
`defaultPreset: "cloudflare-module"`, pero es un _default_. Nitro detecta el
proveedor por la variable de entorno `VERCEL` y en el build de Vercel gana el preset
`vercel`. Consecuencias:

- En producción el runtime es **Node**, así que `process.env` funciona y
  `node:crypto` está disponible.
- Un `npm run build` **local** genera un bundle de Cloudflare (`.output/` y
  `.wrangler/`). Es normal y no refleja lo que corre en producción; no intentes
  "arreglarlo".
- Los secretos se configuran en el dashboard de Vercel y en un `.env` local.
  Nunca con prefijo `VITE_`. `.env.example` documenta cuáles hacen falta.

**Verificado empíricamente (2026-09-08):** el servidor de desarrollo lee `.env`;
**no** lee `.dev.vars` (ese archivo es de Cloudflare Wrangler y aquí no se usa).
`.env` no estaba en `.gitignore` — se añadió, porque habría subido las claves al
repo público.
