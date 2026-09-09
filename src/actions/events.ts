import { createServerFn } from "@tanstack/react-start";

/** Evento tal como lo necesita el formulario público. Sin datos internos. */
export type EventoPublico = {
  slug: string;
  name: string;
  startsAt: string;
  venue: string | null;
};

/**
 * Eventos futuros con las reservas abiertas. Lo consume la landing, así que
 * devuelve solo lo imprescindible: nada de aforo, ids ni conteos.
 */
export const getOpenEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<EventoPublico>> => {
    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

    if (!isDatabaseConfigured()) return [];

    const { data, error } = await getSupabaseAdmin()
      .from("events")
      .select("slug, name, starts_at, venue")
      .eq("reservations_open", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("getOpenEvents:", error);
      return [];
    }

    return (data ?? []).map((fila) => ({
      slug: fila.slug,
      name: fila.name,
      startsAt: fila.starts_at,
      venue: fila.venue,
    }));
  },
);
