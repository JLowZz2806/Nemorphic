---
name: db
description: Trabajar con la base de datos Supabase del proyecto — crear o cambiar tablas, escribir migraciones SQL, consultar datos, configurar RLS y el cliente de servidor. Úsala para suscriptores del newsletter, eventos y reservas de cupos, o ante cualquier error de Supabase.
---

# Base de datos — Supabase

Proveedor decidido: **Supabase** (Postgres gestionado). El sitio corre en Vercel,
así que el runtime es Node y los secretos se leen con `process.env`.

## Modelo de acceso: todo pasa por el servidor

El navegador **nunca** habla con Supabase. Toda lectura y escritura ocurre dentro
de una server function (skill `server-fn`) usando la **clave secreta** del proyecto.

Consecuencia: **RLS activado y sin ninguna policy** en todas las tablas. Así, si
alguna clave pública se filtrara, no daría acceso a nada. La clave secreta salta
RLS por diseño y solo vive en el servidor.

**Sobre el nombre de la clave:** Supabase renovó su sistema de claves. Los
proyectos nuevos —como este— tienen `sb_publishable_…` (para el navegador) y
`sb_secret_…` (para el servidor). Los antiguos tenían `anon` y `service_role`,
ambas con formato JWT (`eyJ…`). Aquí se usa la **secret**, que es la equivalente
moderna de `service_role`. Nunca la publishable: en esta arquitectura el
navegador no habla con Supabase.

No crees variables `VITE_SUPABASE_*`: cualquier cosa con prefijo `VITE_` termina
en el bundle del navegador.

## Estado actual

Nada de esto existe todavía. Al implementarlo hay que crear:

```
src/lib/supabase.ts          cliente admin (solo servidor)
supabase/migrations/*.sql    SQL versionado en el repo, en orden
```

Y añadir la dependencia: `npm i @supabase/supabase-js`
(`bunfig.toml` impone 24 h desde la publicación de un paquete, pero esa regla es
de bun; con npm no aplica — aun así, avisa al usuario antes de añadir dependencias).

## Variables de entorno

| Variable                    | Dónde                                             | Para qué                                |
| --------------------------- | ------------------------------------------------- | --------------------------------------- |
| `SUPABASE_URL`              | `.env` local + Vercel (los tres entornos) | Base del proyecto, **sin** `/rest/v1/`  |
| `SUPABASE_SECRET_KEY`       | igual                                             | `sb_secret_…`, **nunca** al cliente     |

`.env` está en `.gitignore` y bloqueado en
`.claude/settings.json`. Si necesitas saber si una variable está puesta, pregúntale
al usuario; no intentes leer el archivo.

## Cliente (`src/lib/supabase.ts`)

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Solo puede llamarse dentro del handler de una server function. */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY");
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
```

`process.env["X"]` con corchetes: el tsconfig tiene
`noPropertyAccessFromIndexSignature`.

## Esquema

SQL versionado en `supabase/migrations/NNNN_descripcion.sql`, aplicado desde el
SQL Editor de Supabase. Que el archivo esté en el repo es lo que permite saber qué
se aplicó y en qué orden.

```sql
-- 0001_initial.sql

create table public.subscribers (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  status             text not null default 'active'
                       check (status in ('active', 'unsubscribed')),
  unsubscribe_token  uuid not null default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  unsubscribed_at    timestamptz
);

create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  tagline            text,
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  venue              text,
  address            text,
  poster_url         text,
  capacity           integer check (capacity is null or capacity > 0),
  reservations_open  boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.reservations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete restrict,
  holder_name   text not null,
  holder_email  text not null,
  holder_phone  text not null,
  tickets       integer not null check (tickets between 1 and 10),
  code          text not null unique,
  status        text not null default 'confirmed'
                  check (status in ('confirmed', 'cancelled', 'checked_in')),
  created_at    timestamptz not null default now()
);

-- Acompañantes: una fila por persona adicional del titular.
create table public.reservation_guests (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  name            text not null,
  position        integer not null
);

create index on public.reservations (event_id, created_at desc);
create index on public.reservation_guests (reservation_id);
create index on public.subscribers (status);

-- Nadie entra sin pasar por el servidor.
alter table public.subscribers        enable row level security;
alter table public.events             enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_guests enable row level security;
-- Sin policies a propósito: RLS activo y sin policy = acceso denegado para los
-- roles anon y authenticated. La clave secreta del servidor salta RLS.
```

### Cédula: deliberadamente fuera

Se decidió **no pedir cédula** por ahora (dato personal sensible y el proyecto no
tiene todavía el tamaño que lo justifique). Si en el futuro se necesita para el
control en puerta, añádela en una migración aparte y lee primero la skill
`security`: exige minimización, acceso restringido y política de borrado.

## Reglas de escritura

- **Una migración por cambio**, numerada y con nombre descriptivo. Nunca edites una
  migración ya aplicada; crea la siguiente.
- **`select` explícito**: `.select("id, name, starts_at")`, nunca `select("*")` en
  código que devuelve datos al cliente — evita filtrar columnas nuevas sin querer.
- **Comprueba siempre `error`** antes de usar `data`. `data` puede ser `null` y el
  tipo lo refleja.
- **Idempotencia en el newsletter**: `upsert` con `onConflict: "email"`. Suscribirse
  dos veces no debe fallar ni duplicar.
- **Reactivar bajas**: si el correo existe con `status = 'unsubscribed'` y vuelve a
  suscribirse, actualízalo a `'active'`.

## Aforo: cuidado con el sobrecupo

Contar reservas y luego insertar en dos consultas separadas permite que dos
personas reserven las últimas entradas a la vez. Cuando el evento tenga `capacity`,
hazlo atómico con una función en Postgres que bloquee la fila del evento
(`select ... for update`) antes de validar el aforo e insertar, y llámala con
`supabase.rpc("reserve_spot", { ... })`.

## Acceso para el equipo no técnico

Dos vías complementarias:

1. **Panel de admin en la propia página** (skill `admin`) — la vía principal: está
   en español, solo muestra lo necesario y no permite romper nada.
2. **Table Editor del dashboard de Supabase** — para consultas puntuales o
   correcciones. Hay que invitar a los integrantes como miembros del proyecto;
   confirma antes con el usuario cuántos miembros permite su plan.

## Verificación

- `npm run check` después de cualquier cambio de tipos.
- Tras aplicar una migración, confirma en el dashboard que RLS aparece **enabled**
  en todas las tablas nuevas.
- Prueba el camino de error: quita temporalmente una variable de entorno y comprueba
  que el formulario muestra un mensaje amable y no una pantalla en blanco.
