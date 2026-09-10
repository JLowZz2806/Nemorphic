-- 0004_boletin.sql
--
-- Registro de los boletines enviados.
--
-- Hace falta por tres razones, y las tres importan aunque la lista sea pequeña:
--
--  1. Un envío no cabe siempre en una sola petición. Vercel corta las funciones a
--     los pocos segundos, así que el envío va por lotes y hay que saber por dónde
--     se quedó para reanudar.
--  2. Sin registro, pulsar "Enviar" dos veces manda el boletín dos veces a las
--     mismas personas.
--  3. Da historial: qué se mandó, cuándo y a cuántos.

-- ---------------------------------------------------------------------------
-- Un boletín redactado desde el panel.
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id         uuid        primary key default gen_random_uuid(),
  subject    text        not null,
  -- Texto plano tal como lo escribió el equipo. El HTML se arma al enviar, así
  -- que un cambio en la plantilla no reescribe lo ya guardado.
  body       text        not null,
  status     text        not null default 'draft'
               check (status in ('draft', 'sending', 'sent')),
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

comment on table public.campaigns is
  'Boletines redactados desde /admin. El cuerpo se guarda en texto plano.';

-- ---------------------------------------------------------------------------
-- Una fila por persona a la que se le envió (o se intentó enviar).
--
-- `unique (campaign_id, subscriber_id)` es lo que impide enviar dos veces el
-- mismo boletín a la misma persona: el envío por lotes consulta esta tabla para
-- saber a quién le falta.
--
-- El borrado va en cascada desde las dos partes: si alguien pide que borremos sus
-- datos, desaparece también su rastro en los envíos.
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_sends (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references public.campaigns (id) on delete cascade,
  subscriber_id uuid        not null references public.subscribers (id) on delete cascade,
  sent_at       timestamptz not null default now(),
  -- Null si salió bien. Si no, el motivo, para poder reintentar solo los fallidos.
  error         text,
  unique (campaign_id, subscriber_id)
);

create index if not exists campaign_sends_campaign_idx
  on public.campaign_sends (campaign_id);

create index if not exists campaigns_created_idx
  on public.campaigns (created_at desc);

-- ---------------------------------------------------------------------------
-- Como el resto: solo entra el servidor con la clave secreta.
-- ---------------------------------------------------------------------------
alter table public.campaigns      enable row level security;
alter table public.campaign_sends enable row level security;
