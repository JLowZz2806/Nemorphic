import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import {
  adminReservationSchema,
  adminReservationUpdateSchema,
  generarCodigoReserva,
} from "@/schemas/reservation";

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
  paid: boolean;
  /** Desde dónde se marcó el pago, para poder cuadrar caja. */
  paidBy: "admin" | "door" | null;
  /** Desde dónde se marcó el ingreso. */
  checkedInBy: "admin" | "door" | null;
  /** Lo que debe esta reserva, en pesos. Null si el evento no tiene precio. */
  totalAPagar: number | null;
};

export type EventoAdmin = {
  slug: string;
  name: string;
  startsAt: string;
  capacity: number | null;
  reservationsOpen: boolean;
  presalePrice: number | null;
  doorPrice: number | null;
  /** Si es el que la landing muestra en #eventos. */
  featured: boolean;
  /** Suma de lo cobrado, en pesos: reservas pagadas y no canceladas. */
  totalCobrado: number;
  /** Suma de lo que falta cobrar. */
  totalPendiente: number;
  reservas: Array<ReservaAdmin>;
  /** Entradas comprometidas: solo cuentan las que no están canceladas. */
  entradasComprometidas: number;
};

export const listReservations = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<EventoAdmin>> => {
    await requireAdmin();

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
    if (!isDatabaseConfigured()) return [];

    const supabase = getSupabaseAdmin();

    const { data: eventos, error: eventosError } = await supabase
      .from("events")
      .select(
        "id, slug, name, starts_at, capacity, reservations_open, presale_price, door_price, featured",
      )
      .order("starts_at", { ascending: false });

    if (eventosError) {
      console.error("listReservations (eventos):", eventosError);
      throw new Error("No se pudieron cargar los eventos");
    }

    const { data: reservas, error: reservasError } = await supabase
      .from("reservations")
      // Cadena literal en una sola pieza: Supabase infiere los tipos analizando
      // este texto, y una concatenacion en tiempo de ejecucion le hace perder el tipo.
      .select(
        "id, event_id, code, holder_name, holder_email, holder_phone, tickets, status, created_at, paid, paid_by, checked_in_by",
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
          paid: r.paid,
          paidBy: r.paid_by as ReservaAdmin["paidBy"],
          checkedInBy: r.checked_in_by as ReservaAdmin["checkedInBy"],
          totalAPagar:
            typeof evento.presale_price === "number" ? evento.presale_price * r.tickets : null,
        }));

      const vivas = propias.filter((r) => r.status !== "cancelled");

      return {
        slug: evento.slug,
        name: evento.name,
        startsAt: evento.starts_at,
        capacity: evento.capacity,
        reservationsOpen: evento.reservations_open,
        presalePrice: evento.presale_price,
        doorPrice: evento.door_price,
        featured: evento.featured ?? false,
        reservas: propias,
        entradasComprometidas: vivas.reduce((suma, r) => suma + r.tickets, 0),
        totalCobrado: vivas
          .filter((r) => r.paid)
          .reduce((suma, r) => suma + (r.totalAPagar ?? 0), 0),
        totalPendiente: vivas
          .filter((r) => !r.paid)
          .reduce((suma, r) => suma + (r.totalAPagar ?? 0), 0),
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

/**
 * Alta manual desde el panel, para cuando alguien pide su cupo por WhatsApp o en
 * persona. A diferencia del formulario público, no comprueba el aforo: quien lo
 * usa es del equipo y puede necesitar meter a alguien por encima del límite.
 *
 * Manda la misma confirmación que el formulario público: quien pide el cupo por
 * WhatsApp o por Instagram necesita su código igual que cualquiera, y dictárselo
 * a mano es de donde salen los códigos mal copiados.
 */
export const createReservationAsAdmin = createServerFn({ method: "POST" })
  .validator(adminReservationSchema)
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();

    const { data: evento, error: eventoError } = await supabase
      .from("events")
      .select("id, name, tagline, starts_at, venue")
      .eq("slug", data.eventSlug)
      .maybeSingle();

    if (eventoError || !evento) {
      console.error("createReservationAsAdmin (evento):", eventoError);
      return { ok: false as const, message: "Ese evento no existe." };
    }

    for (let intento = 0; intento < 10; intento++) {
      const code = generarCodigoReserva();

      const { data: reserva, error } = await supabase
        .from("reservations")
        .insert({
          event_id: evento.id,
          holder_name: data.holderName,
          holder_email: data.holderEmail,
          holder_phone: data.holderPhone,
          tickets: data.tickets,
          code,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") continue;
        console.error("createReservationAsAdmin (insert):", error);
        return { ok: false as const, message: "No se pudo crear la reserva." };
      }

      if (data.guests.length > 0) {
        const { error: guestsError } = await supabase.from("reservation_guests").insert(
          data.guests.map((invitado, indice) => ({
            reservation_id: reserva.id,
            name: invitado.name,
            position: indice + 1,
          })),
        );

        if (guestsError) {
          console.error("createReservationAsAdmin (acompañantes):", guestsError);
          await supabase.from("reservations").delete().eq("id", reserva.id);
          return { ok: false as const, message: "No se pudieron guardar los acompañantes." };
        }
      }

      const { enviarConfirmacionDeReserva } = await import("@/lib/email/reserva");
      const correoEnviado = await enviarConfirmacionDeReserva({
        para: data.holderEmail,
        nombre: data.holderName,
        codigo: code,
        evento: evento.name,
        eslogan: evento.tagline,
        inicio: evento.starts_at,
        lugar: evento.venue,
        entradas: data.tickets,
      });

      return { ok: true as const, code, correoEnviado };
    }

    return { ok: false as const, message: "No se pudo generar un código único." };
  });

/**
 * Edición de una reserva existente. Los acompañantes se reemplazan por completo:
 * es más simple y más seguro que intentar casar cuál cambió.
 */
export const updateReservation = createServerFn({ method: "POST" })
  .validator(adminReservationUpdateSchema)
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();

    const { data: evento, error: eventoError } = await supabase
      .from("events")
      .select("id")
      .eq("slug", data.eventSlug)
      .maybeSingle();

    if (eventoError || !evento) {
      return { ok: false as const, message: "Ese evento no existe." };
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        event_id: evento.id,
        holder_name: data.holderName,
        holder_email: data.holderEmail,
        holder_phone: data.holderPhone,
        tickets: data.tickets,
      })
      .eq("id", data.id);

    if (error) {
      console.error("updateReservation:", error);
      return { ok: false as const, message: "No se pudo guardar la reserva." };
    }

    const { error: borradoError } = await supabase
      .from("reservation_guests")
      .delete()
      .eq("reservation_id", data.id);

    if (borradoError) {
      console.error("updateReservation (borrar acompañantes):", borradoError);
      return { ok: false as const, message: "No se pudieron actualizar los acompañantes." };
    }

    if (data.guests.length > 0) {
      const { error: guestsError } = await supabase.from("reservation_guests").insert(
        data.guests.map((invitado, indice) => ({
          reservation_id: data.id,
          name: invitado.name,
          position: indice + 1,
        })),
      );

      if (guestsError) {
        console.error("updateReservation (acompañantes):", guestsError);
        return { ok: false as const, message: "No se pudieron actualizar los acompañantes." };
      }
    }

    return { ok: true as const };
  });

export const deleteReservation = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    // Los acompañantes se borran solos por la clave foránea en cascada.
    const { error } = await getSupabaseAdmin().from("reservations").delete().eq("id", data.id);

    if (error) {
      console.error("deleteReservation:", error);
      return { ok: false as const, message: "No se pudo eliminar la reserva." };
    }

    return { ok: true as const };
  });
