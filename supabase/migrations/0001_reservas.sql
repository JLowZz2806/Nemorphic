-- 0001_reservas.sql
--
-- Esquema inicial de Nemorphic: boletín, eventos y reservas de cupos.
-- Se ejecuta una sola vez, desde el SQL Editor de Supabase.
--
-- Modelo de acceso: el navegador NUNCA habla con Supabase. Todo pasa por el
-- servidor con la service_role key. Por eso se activa RLS sin ninguna policy:
-- así, si alguna clave pública se filtrara, no daría acceso a nada.

-- ---------------------------------------------------------------------------
-- Personas suscritas al boletín
-- ---------------------------------------------------------------------------
create table if not exists public.subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text        not null unique,
  status            text        not null default 'active'
                      check (status in ('active', 'unsubscribed')),
  -- Permite darse de baja con un clic, sin iniciar sesión.
  unsubscribe_token uuid        not null default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  unsubscribed_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id                uuid        primary key default gen_random_uuid(),
  -- Identificador legible para las URLs: "umbra".
  slug              text        not null unique,
  name              text        not null,
  tagline           text,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  venue             text,
  address           text,
  poster_url        text,
  -- NULL = sin límite de aforo.
  capacity          integer     check (capacity is null or capacity > 0),
  reservations_open boolean     not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reservas de cupo
--
-- La cédula se deja fuera a propósito: es un dato personal sensible y el sello
-- todavía no tiene un tamaño que lo justifique. Si algún día hace falta para el
-- control en puerta, se añade en una migración aparte.
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references public.events (id) on delete restrict,
  holder_name  text        not null,
  holder_email text        not null,
  holder_phone text        not null,
  tickets      integer     not null check (tickets between 1 and 10),
  -- Código corto que la persona enseña en la puerta.
  code         text        not null unique,
  status       text        not null default 'confirmed'
                 check (status in ('confirmed', 'cancelled', 'checked_in')),
  created_at   timestamptz not null default now()
);

-- Acompañantes: una fila por cada persona adicional al titular.
create table if not exists public.reservation_guests (
  id             uuid    primary key default gen_random_uuid(),
  reservation_id uuid    not null references public.reservations (id) on delete cascade,
  name           text    not null,
  -- 1 = primer acompañante. El titular no va en esta tabla.
  position       integer not null check (position >= 1),
  unique (reservation_id, position)
);

-- ---------------------------------------------------------------------------
-- Índices para las consultas del panel
-- ---------------------------------------------------------------------------
create index if not exists reservations_event_created_idx
  on public.reservations (event_id, created_at desc);

create index if not exists reservation_guests_reservation_idx
  on public.reservation_guests (reservation_id);

create index if not exists subscribers_status_idx
  on public.subscribers (status);

create index if not exists events_starts_at_idx
  on public.events (starts_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Se activa en las cuatro tablas y NO se crea ninguna policy. En Postgres, una
-- tabla con RLS activo y sin policies deniega todo a los roles anon y
-- authenticated. La service_role key que usa el servidor salta RLS por diseño.
-- ---------------------------------------------------------------------------
alter table public.subscribers        enable row level security;
alter table public.events             enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_guests enable row level security;

-- ---------------------------------------------------------------------------
-- Datos iniciales: el evento que hoy está escrito a mano en la página
--
-- Las horas van con el desfase de Colombia (-05). Si la fecha o el aforo
-- cambian, se editan desde el panel de administración, no aquí.
-- ---------------------------------------------------------------------------
insert into public.events (slug, name, tagline, starts_at, ends_at, venue, address, poster_url)
values (
  'umbra',
  'UMBRA',
  'Aquí no se escucha. Se siente.',
  '2026-10-03 20:00:00-05',
  '2026-10-04 02:00:00-05',
  'Épica',
  'Av. Paralela #55-35',
  '/Assets/Flyer UMBRA.jpg'
)
on conflict (slug) do nothing;
