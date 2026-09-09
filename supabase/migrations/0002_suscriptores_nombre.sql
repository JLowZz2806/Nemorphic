-- 0002_suscriptores_nombre.sql
--
-- Añade el nombre de la persona suscrita, para poder encabezar el boletín con
-- su nombre en vez de un saludo genérico.
--
-- Es nullable a propósito: puede haber suscriptores antiguos o importados sin
-- nombre, y el envío debe seguir funcionando para ellos con un saludo neutro.
-- El formulario público sí lo pide obligatorio.

alter table public.subscribers
  add column if not exists name text;

comment on column public.subscribers.name is
  'Nombre de pila para personalizar el boletín. Puede ser null en registros antiguos.';
