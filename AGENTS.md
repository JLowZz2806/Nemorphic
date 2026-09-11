# Nemorphic — notas para agentes

Este repo **ya no se edita desde el editor de Lovable**: el trabajo se hace aquí y
se empuja a GitHub (`origin` → `JLowZ/Nemorphic`).

La regla que Lovable dejaba escrita sigue vigente, pero por el motivo de siempre:
**no reescribas historia publicada** — force-push, rebase, amend o squash de
commits ya empujados. `main` está publicado y reescribirlo rompe el clon de
cualquiera que lo tenga.

Lo que **sí** sigue dependiendo de Lovable y no hay que tocar:

- `@lovable.dev/vite-tanstack-config` es toda la configuración de build: Vite,
  TanStack Start y el preset de Nitro que hace funcionar el despliegue en Vercel.
  Quitarlo significa reescribir `vite.config.ts` a mano y arriesgar el deploy.
  De ahí sale también la prohibición de importar desde `**/server/**`.
- `src/lib/lovable-error-reporting.ts`, montado en `src/routes/__root.tsx`. En
  producción no existe `window.__lovableEvents`, así que no hace nada.
- Las exclusiones de `bunfig.toml` (bun no está instalado; se usa npm).

La guía de trabajo del proyecto está en [`CLAUDE.md`](CLAUDE.md).
