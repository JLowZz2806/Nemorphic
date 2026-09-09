-- 0003_pagos_y_puerta.sql
--
-- Añade el control de pagos y lo necesario para el acceso de puerta:
--
--  * Precios por evento (preventa y puerta), para que quien cobra sepa el monto.
--  * Estado de pago de cada reserva, con rastro de cuándo y desde dónde se marcó.
--  * Tabla de ajustes, donde vive el hash de la clave de puerta (cambia en cada
--    evento, así que se edita desde /admin en vez de ser variable de entorno).

-- ---------------------------------------------------------------------------
-- Precios del evento, en pesos colombianos y sin decimales.
--
-- `presale_price` es lo que paga quien reservó, aunque pague en la puerta: eso es
-- justo el incentivo de reservar. `door_price` es lo que paga quien llega sin
-- reserva, y se muestra en la puerta solo como referencia.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists presale_price integer
    check (presale_price is null or presale_price >= 0),
  add column if not exists door_price integer
    check (door_price is null or door_price >= 0);

comment on column public.events.presale_price is
  'Precio por entrada para quien reservó (COP). Null = sin precio definido.';
comment on column public.events.door_price is
  'Precio por entrada en puerta sin reserva (COP). Solo informativo.';

-- ---------------------------------------------------------------------------
-- Estado de pago y de ingreso.
--
-- Se guarda desde dónde se marcó cada cosa ('admin' o 'door') para poder cuadrar
-- la caja después y detectar si algo se marcó donde no debía.
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by text
    check (paid_by is null or paid_by in ('admin', 'door')),
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text
    check (checked_in_by is null or checked_in_by in ('admin', 'door'));

-- ---------------------------------------------------------------------------
-- Ajustes de la aplicación.
--
-- Clave-valor porque el primer uso es uno solo: `door_password_hash`. Se guarda
-- el hash, nunca la clave. Si la fila no existe, el acceso de puerta está cerrado.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Ajustes editables desde el panel. Nunca guarda secretos en claro.';

alter table public.app_settings enable row level security;
-- Sin policies, como el resto: solo el servidor con la clave secreta entra.

-- ---------------------------------------------------------------------------
-- Precios de UMBRA con los valores de referencia que se comentaron.
--
-- REVÍSALOS en /admin → Reservas: si no son los reales, cámbialos antes del
-- evento, porque son los que verá quien cobre en la puerta.
-- ---------------------------------------------------------------------------
update public.events
set presale_price = 15000,
    door_price = 20000
where slug = 'umbra'
  and presale_price is null;
