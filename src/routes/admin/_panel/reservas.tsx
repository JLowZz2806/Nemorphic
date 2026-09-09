import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  listReservations,
  setReservationStatus,
  type ReservaAdmin,
} from "@/actions/admin-reservations";

export const Route = createFileRoute("/admin/_panel/reservas")({
  component: Reservas,
});

const ETIQUETAS: Record<ReservaAdmin["status"], string> = {
  confirmed: "Confirmada",
  checked_in: "Ya entró",
  cancelled: "Cancelada",
};

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function formatearMomento(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function Reservas() {
  const queryClient = useQueryClient();
  const [eventoAbierto, setEventoAbierto] = useState<string | null>(null);

  const consulta = useQuery({
    queryKey: ["admin", "reservas"],
    queryFn: () => listReservations(),
  });

  const cambiarEstado = useMutation({
    mutationFn: (variables: { id: string; status: ReservaAdmin["status"] }) =>
      setReservationStatus({ data: variables }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "reservas"] });
      toast.success("Reserva actualizada");
    },
    onError: () => toast.error("No se pudo actualizar. Intenta de nuevo."),
  });

  if (consulta.isLoading) {
    return (
      <>
        <h1 className="nm-admin-title">Reservas</h1>
        <p className="nm-admin-lead">Cargando…</p>
      </>
    );
  }

  if (consulta.isError) {
    return (
      <>
        <h1 className="nm-admin-title">Reservas</h1>
        <p className="nm-admin-lead">
          No se pudieron cargar las reservas. Recarga la página; si sigue fallando, avisa al
          desarrollador.
        </p>
      </>
    );
  }

  const eventos = consulta.data ?? [];
  const seleccionado = eventoAbierto ?? eventos[0]?.slug ?? null;
  const evento = eventos.find((e) => e.slug === seleccionado);

  return (
    <>
      <h1 className="nm-admin-title">Reservas</h1>
      <p className="nm-admin-lead">
        Quiénes reservaron su cupo. Marca <strong>Ya entró</strong> en la puerta del evento para
        llevar el control de asistencia.
      </p>

      {eventos.length === 0 ? (
        <p className="nm-admin-vacio">Todavía no hay eventos creados.</p>
      ) : (
        <>
          {eventos.length > 1 && (
            <div className="nm-admin-toolbar">
              <label htmlFor="nm-admin-evento" className="nm-campo">
                Evento
              </label>
              <select
                id="nm-admin-evento"
                className="nm-input"
                value={seleccionado ?? ""}
                onChange={(e) => setEventoAbierto(e.target.value)}
              >
                {eventos.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name} — {formatearFecha(e.startsAt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {evento && (
            <>
              <dl className="nm-admin-resumen">
                <div className="nm-admin-dato">
                  <dt>Reservas</dt>
                  <dd>{evento.reservas.filter((r) => r.status !== "cancelled").length}</dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Entradas</dt>
                  <dd>
                    {evento.entradasComprometidas}
                    {evento.capacity !== null && ` / ${evento.capacity}`}
                  </dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Ya entraron</dt>
                  <dd>{evento.reservas.filter((r) => r.status === "checked_in").length}</dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Reservas</dt>
                  <dd style={{ fontSize: "1rem" }}>
                    {evento.reservationsOpen ? "Abiertas" : "Cerradas"}
                  </dd>
                </div>
              </dl>

              {evento.reservas.length === 0 ? (
                <p className="nm-admin-vacio">
                  Nadie ha reservado todavía para {evento.name}. En cuanto alguien lo haga,
                  aparecerá aquí.
                </p>
              ) : (
                <div className="nm-reserva-lista">
                  {evento.reservas.map((reserva) => (
                    <article className="nm-reserva-item" key={reserva.id}>
                      <div className="nm-reserva-cabecera">
                        <span className="nm-reserva-item-codigo">{reserva.code}</span>
                        <span className="nm-reserva-nombre">{reserva.holderName}</span>
                        <span className={`nm-etiqueta nm-etiqueta--${reserva.status}`}>
                          {ETIQUETAS[reserva.status]}
                        </span>
                        <span className="nm-reserva-entradas">
                          {reserva.tickets} entrada{reserva.tickets === 1 ? "" : "s"} ·{" "}
                          {formatearMomento(reserva.createdAt)}
                        </span>
                      </div>

                      <div className="nm-reserva-contacto">
                        <a href={`mailto:${reserva.holderEmail}`}>{reserva.holderEmail}</a>
                        <a href={`tel:${reserva.holderPhone.replace(/\s/g, "")}`}>
                          {reserva.holderPhone}
                        </a>
                      </div>

                      {reserva.guests.length > 0 && (
                        <div className="nm-reserva-invitados">
                          Acompañantes:
                          <ol>
                            {reserva.guests.map((nombre, i) => (
                              <li key={`${reserva.id}-${i}`}>{nombre}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div className="nm-reserva-acciones">
                        {reserva.status !== "checked_in" && (
                          <button
                            type="button"
                            className="nm-admin-logout"
                            disabled={cambiarEstado.isPending}
                            onClick={() =>
                              cambiarEstado.mutate({ id: reserva.id, status: "checked_in" })
                            }
                          >
                            Marcar que ya entró
                          </button>
                        )}
                        {reserva.status !== "cancelled" ? (
                          <button
                            type="button"
                            className="nm-admin-logout"
                            disabled={cambiarEstado.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `¿Cancelar la reserva ${reserva.code} de ${reserva.holderName}? Liberará ${reserva.tickets} entrada${reserva.tickets === 1 ? "" : "s"}.`,
                                )
                              ) {
                                return;
                              }
                              cambiarEstado.mutate({ id: reserva.id, status: "cancelled" });
                            }}
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="nm-admin-logout"
                            disabled={cambiarEstado.isPending}
                            onClick={() =>
                              cambiarEstado.mutate({ id: reserva.id, status: "confirmed" })
                            }
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
