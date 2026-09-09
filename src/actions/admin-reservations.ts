import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ReservaAdmin = {
  id: string;
  code: string;
  holderName: string;
  holderEmail: string;
  holderPhone: string;
  tickets: number;
  status: "confirmed" | "cancelled" | "checked_in";
  createdAt: string;
  guests: Array<string>;
};

export type EventoAdmin = {
  slug: string;
  name: string;
  startsAt: string;
  capacity: number | null;
  reservationsOpen: boolean;
  reservas: Array<ReservaAdmin>;
  /** Entradas comprometidas: solo cuentan las que no están canceladas. */
  entradasComprometidas: number;
};

/**
 * Guarda de sesión para todo lo del panel. `beforeLoad` protege la navegación,
 * pero no la API: cualquiera puede llamar a una server function directamente.
 */
async function requireAdmin(): Promise<void> {
  const { isAdmin } = await import("@/lib/auth");
  if (!(await isAdmin())) {
    throw new Error("No autorizado");
  }
}

export const listReservations = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<EventoAdmin>> => {
    await requireAdmin();

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
    if (!isDatabaseConfigured()) return [];

    const supabase = getSupabaseAdmin();

    const { data: eventos, error: eventosError } = await supabase
      .from("events")
      .select("id, slug, name, starts_at, capacity, reservations_open")
      .order("starts_at", { ascending: false });

    if (eventosError) {
      console.error("listReservations (eventos):", eventosError);
      throw new Error("No se pudieron cargar los eventos");
    }

    const { data: reservas, error: reservasError } = await supabase
      .from("reservations")
      .select(
        "id, event_id, code, holder_name, holder_email, holder_phone, tickets, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (reservasError) {
      console.error("listReservations (reservas):", reservasError);
      throw new Error("No se pudieron cargar las reservas");
    }

    const { data: invitados, error: invitadosError } = await supabase
      .from("reservation_guests")
      .select("reservation_id, name, position")
      .order("position", { ascending: true });

    if (invitadosError) {
      console.error("listReservations (acompañantes):", invitadosError);
      throw new Error("No se pudieron cargar los acompañantes");
    }

    const porReserva = new Map<string, Array<string>>();
    for (const fila of invitados ?? []) {
      const lista = porReserva.get(fila.reservation_id) ?? [];
      lista.push(fila.name);
      porReserva.set(fila.reservation_id, lista);
    }

    return (eventos ?? []).map((evento) => {
      const propias = (reservas ?? [])
        .filter((r) => r.event_id === evento.id)
        .map((r) => ({
          id: r.id,
          code: r.code,
          holderName: r.holder_name,
          holderEmail: r.holder_email,
          holderPhone: r.holder_phone,
          tickets: r.tickets,
          status: r.status as ReservaAdmin["status"],
          createdAt: r.created_at,
          guests: porReserva.get(r.id) ?? [],
        }));

      return {
        slug: evento.slug,
        name: evento.name,
        startsAt: evento.starts_at,
        capacity: evento.capacity,
        reservationsOpen: evento.reservations_open,
        reservas: propias,
        entradasComprometidas: propias
          .filter((r) => r.status !== "cancelled")
          .reduce((suma, r) => suma + r.tickets, 0),
      };
    });
  },
);

const cambiarEstadoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["confirmed", "cancelled", "checked_in"]),
});

export const setReservationStatus = createServerFn({ method: "POST" })
  .validator(cambiarEstadoSchema)
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { error } = await getSupabaseAdmin()
      .from("reservations")
      .update({ status: data.status })
      .eq("id", data.id);

    if (error) {
      console.error("setReservationStatus:", error);
      return { ok: false as const, message: "No se pudo actualizar la reserva." };
    }

    return { ok: true as const };
  });
