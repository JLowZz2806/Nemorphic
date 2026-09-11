import { createServerFn } from "@tanstack/react-start";

import { generarCodigoReserva, reservationSchema } from "@/schemas/reservation";

export type ReservationResult =
  | {
      ok: true;
      code: string;
      eventName: string;
      /**
       * Si se le pudo mandar el código por correo. Va al formulario para no
       * prometer un correo que nunca salió: sin esto, quien no lo reciba
       * pensaría que perdió el cupo.
       */
      correoEnviado: boolean;
    }
  | { ok: false; message: string };

/**
 * Manda la confirmación con el código de entrada.
 *
 * Nunca tira hacia arriba: la reserva ya está guardada y es lo que importa. Si
 * el correo falla, la persona sigue viendo el código en pantalla y el equipo lo
 * tiene en /admin/reservas, así que se registra el fallo y se sigue.
 */
async function enviarConfirmacion(datos: {
  para: string;
  nombre: string;
  codigo: string;
  evento: string;
  eslogan: string | null;
  inicio: string | null;
  lugar: string | null;
  entradas: number;
}): Promise<boolean> {
  try {
    const { isEmailConfigured, enviarCorreo } = await import("@/lib/email/provider");

    if (!isEmailConfigured()) {
      console.error(
        "createReservation: faltan EMAIL_FROM o EMAIL_APP_PASSWORD, no se envió la confirmación.",
      );
      return false;
    }

    const plantillas = await import("@/lib/email/templates");
    const contenido = {
      nombre: datos.nombre,
      codigo: datos.codigo,
      evento: datos.evento,
      eslogan: datos.eslogan,
      inicio: datos.inicio,
      lugar: datos.lugar,
      entradas: datos.entradas,
    };

    await enviarCorreo({
      to: datos.para,
      subject: plantillas.asuntoReserva(contenido),
      html: plantillas.renderReservaHtml(contenido),
      text: plantillas.renderReservaTexto(contenido),
      // Sin List-Unsubscribe a propósito: es transaccional, no boletín.
    });

    return true;
  } catch (error) {
    console.error("createReservation (correo de confirmación):", error);
    return false;
  }
}

export const createReservation = createServerFn({ method: "POST" })
  .validator(reservationSchema)
  .handler(async ({ data }): Promise<ReservationResult> => {
    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

    if (!isDatabaseConfigured()) {
      console.error("createReservation: faltan las variables de Supabase.");
      return { ok: false, message: "Las reservas no están disponibles ahora mismo." };
    }

    const supabase = getSupabaseAdmin();

    const { data: evento, error: eventoError } = await supabase
      .from("events")
      .select("id, name, tagline, starts_at, venue, capacity, reservations_open")
      .eq("slug", data.eventSlug)
      .maybeSingle();

    if (eventoError) {
      console.error("createReservation (evento):", eventoError);
      return { ok: false, message: "No pudimos completar la reserva. Intenta de nuevo." };
    }
    if (!evento) {
      return { ok: false, message: "Ese evento ya no está disponible." };
    }
    if (!evento.reservations_open) {
      return { ok: false, message: "Las reservas para este evento están cerradas." };
    }

    // Control de aforo. No es a prueba de dos reservas simultáneas por las
    // últimas entradas; cuando haya aforos ajustados hay que moverlo a una
    // función de Postgres que bloquee la fila del evento (ver skill `db`).
    if (typeof evento.capacity === "number") {
      const { data: reservas, error: aforoError } = await supabase
        .from("reservations")
        .select("tickets")
        .eq("event_id", evento.id)
        .eq("status", "confirmed");

      if (aforoError) {
        console.error("createReservation (aforo):", aforoError);
        return { ok: false, message: "No pudimos completar la reserva. Intenta de nuevo." };
      }

      const ocupadas = (reservas ?? []).reduce((suma, fila) => suma + (fila.tickets ?? 0), 0);
      const libres = evento.capacity - ocupadas;

      if (libres <= 0) {
        return { ok: false, message: "El aforo está completo." };
      }
      if (data.tickets > libres) {
        return {
          ok: false,
          message: `Solo quedan ${libres} entrada${libres === 1 ? "" : "s"} disponible${libres === 1 ? "" : "s"}.`,
        };
      }
    }

    // El código es único en la base; si por casualidad se repite, se reintenta.
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
        // 23505 = violación de unicidad, es decir, código repetido.
        if (error.code === "23505") continue;
        console.error("createReservation (insert):", error);
        return { ok: false, message: "No pudimos completar la reserva. Intenta de nuevo." };
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
          // Una reserva sin sus acompañantes es peor que ninguna: se deshace
          // para que la persona pueda reintentar sin quedar a medias.
          console.error("createReservation (acompañantes):", guestsError);
          await supabase.from("reservations").delete().eq("id", reserva.id);
          return { ok: false, message: "No pudimos guardar los acompañantes. Intenta de nuevo." };
        }
      }

      // El correo va antes de responder: en Vercel no hay tarea de fondo, y lo
      // que se dispare después de devolver puede morir con la función.
      const correoEnviado = await enviarConfirmacion({
        para: data.holderEmail,
        nombre: data.holderName,
        codigo: code,
        evento: evento.name,
        eslogan: evento.tagline,
        inicio: evento.starts_at,
        lugar: evento.venue,
        entradas: data.tickets,
      });

      return { ok: true, code, eventName: evento.name, correoEnviado };
    }

    console.error("createReservation: no se pudo generar un código único en 5 intentos.");
    return { ok: false, message: "No pudimos completar la reserva. Intenta de nuevo." };
  });
