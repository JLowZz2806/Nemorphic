---
name: check
description: Verificar que el proyecto está sano — ejecuta typecheck, lint y el smoke test, interpreta los fallos y los arregla. Úsala antes de dar por terminado cualquier cambio, después de un merge, o cuando algo dejó de funcionar y no sabes por qué.
---

# Verificación

```sh
npm run check     # typecheck + lint + smoke, en ese orden
```

Se detiene en el primer fallo. Los pasos por separado:

| Comando             | Qué comprueba                                                      |
| ------------------- | ------------------------------------------------------------------ |
| `npm run typecheck` | `tsc --noEmit` sobre `src/`, `vite.config.ts` y `eslint.config.js` |
| `npm run lint`      | ESLint + reglas de Prettier + react-hooks + react-refresh          |
| `npm run smoke`     | Levanta `vite dev` y valida el HTML de SSR de `/`                  |
| `npm run format`    | Reescribe con Prettier (arregla la mayoría de errores de lint)     |
| `npm run build`     | Build de producción completo — más lento, para cambios grandes     |

## Cómo leer cada fallo

### typecheck

El tsconfig es estricto de verdad. Los errores más habituales aquí:

- **`Object is possibly 'undefined'` al indexar** → `noUncheckedIndexedAccess`.
  `array[0]` y `record[clave]` son `T | undefined`. Comprueba antes de usar; no
  silencies con `!` salvo que tengas una razón real.
- **`Type 'undefined' is not assignable`** en una propiedad opcional →
  `exactOptionalPropertyTypes`. No pases `undefined` explícito: omite la clave.
- **`Property 'X' comes from an index signature`** →
  `noPropertyAccessFromIndexSignature`. Usa `obj["X"]`. Pasa siempre con
  `process.env`.
- **`Not all code paths return a value`** → `noImplicitReturns`.

### lint

Casi todo lo que sale es formato. Ejecuta `npm run format` y vuelve a correrlo.

Lo que **no** arregla el formateo:

- `react-hooks/exhaustive-deps` — falta una dependencia en un `useEffect`. Piénsalo,
  no lo silencies a ciegas.
- `react-refresh/only-export-components` — hay **6 warnings preexistentes** en
  `src/components/ui/` (código de shadcn). El objetivo es **0 errores**, no 0
  warnings; no los persigas.

Si aparecen cientos de errores `Delete \`␍\``, alguien quitó `endOfLine: "auto"`de`.prettierrc`. El checkout usa CRLF (`core.autocrlf=true` en Windows) y sin esa
opción Prettier marca cada línea del repo. Devuélvela en vez de reformatear todo.

### smoke

`scripts/smoke.mjs` levanta el servidor de desarrollo, pide `/` y comprueba 12
fragmentos del HTML renderizado en el servidor.

- **`Falta <algo> — no se encontró <texto>`**: el SSR dejó de renderizar esa parte.
  Suele ser un cambio en el JSX o en `src/data/nemorphic.ts`. Si el cambio es
  intencionado, actualiza el array `CHECKS` del script.
- **`La home renderizó la página de error del servidor`**: hay una excepción en el
  render de SSR. Corre `npm run dev` y mira la consola: el error real sale ahí
  (`src/server.ts` convierte los 500 tragados por h3 en una página de error).
- **`El dev server no arrancó en 120s`**: normalmente falta `npm install`, o el
  puerto está ocupado por un `vite dev` zombi. Comprueba con
  `netstat -ano | grep :8080`. El script busca puerto libre solo, así que si falla,
  el problema es otro.
- Contra un servidor ya levantado: `node scripts/smoke.mjs --url http://localhost:8080`.

## Cuando añadas una funcionalidad

Suma su comprobación al array `CHECKS` de `scripts/smoke.mjs`. El smoke test es el
único test del proyecto: si no crece con el sitio, deja de proteger nada.

Para el newsletter, las reservas y el panel de admin haría falta más que HTML
renderizado. Cuando lleguen, propón instalar Vitest y mover `CHECKS` a tests de
verdad — pero no lo hagas sin acordarlo con el usuario.

## Qué no cubre

- No hay tests unitarios ni de integración.
- El smoke solo mira `/` con SSR: no comprueba interacción, ni JavaScript en el
  navegador, ni el aspecto visual (para eso, skill `visual-audit`).
- `npm run build` no está en `check` porque tarda; córrelo aparte cuando toques
  configuración, rutas o dependencias.
