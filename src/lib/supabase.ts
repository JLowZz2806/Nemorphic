import { env } from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Cliente de Supabase con la clave secreta del proyecto.
 *
 * Solo puede llamarse desde el servidor — dentro del `.handler()` de una server
 * function. La clave salta Row Level Security: quien la tenga puede leer y borrar
 * toda la base, así que nunca debe acabar en el bundle del navegador.
 *
 * El navegador no habla con Supabase en ningún momento; por eso las tablas van con
 * RLS activo y sin ninguna policy (ver `supabase/migrations/0001_reservas.sql`).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_SECRET_KEY"];

  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY. En local van en .env; en producción, " +
        "en las variables de entorno de Vercel.",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

/** `true` si el entorno tiene lo necesario para hablar con la base de datos. */
export function isDatabaseConfigured(): boolean {
  return Boolean(env["SUPABASE_URL"] && env["SUPABASE_SECRET_KEY"]);
}
