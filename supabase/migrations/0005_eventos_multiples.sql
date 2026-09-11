-- 0005_eventos_multiples.sql
--
-- Varios eventos anunciados a la vez.
--
-- Hasta ahora había uno solo, y la sección #eventos de la landing lo tenía
-- escrito a mano en el JSX mientras la fila de `events` servía únicamente para
-- las reservas. Con dos eventos eso deja de aguantar: cada cambio habría que
-- hacerlo en dos sitios, y el fallo que se cuela es mostrar el flyer de uno con
-- el botón que reserva para el otro.
--
-- A partir de aquí la landing lee de esta tabla. Esta migración solo añade lo que
-- faltaba para poder hacerlo: saber CUÁL de los eventos se muestra arriba.

-- ---------------------------------------------------------------------------
-- El evento destacado
--
-- No se deduce de la fecha a propósito. El más próximo no siempre es el que se
-- quiere enseñar: puede haber una fecha contratada por otro y un evento propio
-- del sello más adelante, y el que manda la cara de la web es el segundo.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists featured boolean not null default false;

comment on column public.events.featured is
  'El evento que la landing muestra en #eventos. Solo puede haber uno.';

-- Que solo haya uno no es un detalle estético: con dos destacados la landing
-- tendría que elegir por su cuenta y mostraría uno distinto según el orden en
-- que Postgres devuelva las filas. El índice parcial lo impide de raíz.
create unique index if not exists events_un_solo_destacado
  on public.events ((true))
  where featured;

-- ---------------------------------------------------------------------------
-- Datos: el evento que ya estaba y el nuevo
-- ---------------------------------------------------------------------------

-- UMBRA sigue siendo la cara de la web hasta que se diga lo contrario desde
-- /admin. Se marca solo si no hay ya otro destacado, para que reaplicar esta
-- migración no pise una decisión tomada después.
update public.events
set featured = true
where slug = 'umbra'
  and not exists (select 1 from public.events where featured);

-- Fecha contratada: 27 de septiembre de 2026, de 9 PM a 3 AM (termina ya el 28).
-- Las horas van con el desfase de Colombia (-05).
--
-- Sin eslogan, sin flyer y sin dirección todavía: la landing y la página de
-- eventos contemplan que falten. Cuando lleguen, se editan aquí o desde el panel;
-- el precio se pone en /admin/reservas antes de abrir las reservas de verdad.
insert into public.events (slug, name, starts_at, ends_at, venue, reservations_open)
values (
  'sembrando-consciencia',
  'Sembrando Consciencia x Nemorphic',
  '2026-09-27 21:00:00-05',
  '2026-09-28 03:00:00-05',
  null,
  true
)
on conflict (slug) do nothing;
