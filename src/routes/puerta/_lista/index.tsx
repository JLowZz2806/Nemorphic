import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { listReservationsForDoor, setCheckIn, setPaid, type ReservaPuerta } from "@/actions/door";

export const Route = createFileRoute("/puerta/_lista/")({
  component: ControlEntrada,
});

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/** Quita acentos y mayusculas, para que buscar "jose" encuentre "Jose" con tilde. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function ControlEntrada() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [eventoElegido, setEventoElegido] = useState<string | null>(null);

  const consulta = useQuery({
    queryKey: ["puerta", "reservas"],
    queryFn: () => listReservationsForDoor(),
    // En la puerta puede haber dos personas marcando a la vez.
    refetchInterval: 30_000,
  });

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["puerta", "reservas"] });
  };

  const ingreso = useMutation({
    mutationFn: (v: { id: string; entered: boolean }) => setCheckIn({ data: v }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
    },
    onError: () => toast.error("No se pudo guardar. Revisa la señal."),
  });

  const pago = useMutation({
    mutationFn: (v: { id: string; paid: boolean }) => setPaid({ data: v }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
    },
    onError: () => toast.error("No se pudo guardar. Revisa la señal."),
  });

  if (consulta.isLoading) {
    return (
      <>
        <h1 className="nm-admin-title">Control de entrada</h1>
        <p className="nm-admin-lead">Cargando…</p>
      </>
    );
  }

  if (consulta.isError) {
    return (
      <>
        <h1 className="nm-admin-title">Control de entrada</h1>
        <p className="nm-admin-lead">No se pudo cargar. Recarga la página.</p>
      </>
    );
  }

  const eventos = consulta.data ?? [];

  if (eventos.length === 0) {
    return (
      <>
        <h1 className="nm-admin-title">Control de entrada</h1>
        <p className="nm-admin-vacio">No hay eventos próximos.</p>
      </>
    );
  }

  const slug = eventoElegido ?? eventos[0]?.slug ?? null;
  const evento = eventos.find((e) => e.slug === slug) ?? eventos[0];
  if (!evento) return null;

  const termino = normalizar(busqueda.trim());
  const visibles = termino
    ? evento.reservas.filter(
        (r) =>
          normalizar(r.code).includes(termino) ||
          normalizar(r.holderName).includes(termino) ||
          r.guests.some((g) => normalizar(g).includes(termino)),
      )
    : evento.reservas;

  const entradasTotales = evento.reservas
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.tickets, 0);
  const yaEntraron = evento.reservas.filter((r) => r.status === "checked_in").length;
  const porCobrar = evento.reservas
    .filter((r) => r.status !== "cancelled" && !r.paid)
    .reduce((s, r) => s + (r.totalAPagar ?? 0), 0);

  return (
    <>
      <h1 className="nm-admin-title">{evento.name}</h1>
      <p className="nm-admin-lead">
        {formatearFecha(evento.startsAt)}
        {evento.doorPrice !== null && (
          <>
            {" · "}Sin reserva: <strong>{pesos.format(evento.doorPrice)}</strong> por persona
          </>
        )}
      </p>

      <dl className="nm-admin-resumen">
        <div className="nm-admin-dato">
          <dt>Reservas</dt>
          <dd>{evento.reservas.filter((r) => r.status !== "cancelled").length}</dd>
        </div>
        <div className="nm-admin-dato">
          <dt>Entradas</dt>
          <dd>{entradasTotales}</dd>
        </div>
        <div className="nm-admin-dato">
          <dt>Ya entraron</dt>
          <dd>{yaEntraron}</dd>
        </div>
        <div className="nm-admin-dato">
          <dt>Por cobrar</dt>
          <dd style={{ fontSize: "1.35rem" }}>{pesos.format(porCobrar)}</dd>
        </div>
      </dl>

      <div className="nm-admin-toolbar">
        <input
          type="search"
          className="nm-input"
          placeholder="Buscar por código o nombre"
          aria-label="Buscar reserva"
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {eventos.length > 1 && (
          <select
            className="nm-input"
            aria-label="Elegir evento"
            value={slug ?? ""}
            onChange={(e) => setEventoElegido(e.target.value)}
          >
            {eventos.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="nm-admin-vacio">
          {evento.reservas.length === 0
            ? "Nadie ha reservado para este evento."
            : "Ninguna reserva coincide con esa búsqueda."}
        </p>
      ) : (
        <div className="nm-reserva-lista">
          {visibles.map((reserva: ReservaPuerta) => (
            <article
              className={`nm-reserva-item nm-puerta-item${reserva.status === "checked_in" ? " is-dentro" : ""}${reserva.status === "cancelled" ? " is-cancelada" : ""}`}
              key={reserva.id}
            >
              <div className="nm-reserva-cabecera">
                <span className="nm-reserva-item-codigo">{reserva.code}</span>
                <span className="nm-reserva-nombre">{reserva.holderName}</span>
                <span className="nm-reserva-entradas">
                  {reserva.tickets} entrada{reserva.tickets === 1 ? "" : "s"}
                </span>
              </div>

              <div className="nm-puerta-estados">
                <span
                  className={`nm-etiqueta nm-etiqueta--${reserva.status === "checked_in" ? "checked_in" : reserva.status === "cancelled" ? "cancelled" : "confirmed"}`}
                >
                  {reserva.status === "checked_in"
                    ? "Ya entró"
                    : reserva.status === "cancelled"
                      ? "Cancelada"
                      : "No ha entrado"}
                </span>
                <span className={`nm-etiqueta nm-etiqueta--${reserva.paid ? "active" : "debe"}`}>
                  {reserva.paid
                    ? "Pagado"
                    : reserva.totalAPagar !== null
                      ? `Debe ${pesos.format(reserva.totalAPagar)}`
                      : "Sin pagar"}
                </span>
              </div>

              {reserva.guests.length > 0 && (
                <div className="nm-reserva-invitados">
                  Entran con {reserva.holderName}:
                  <ol>
                    {reserva.guests.map((nombre, i) => (
                      <li key={`${reserva.id}-${i}`}>{nombre}</li>
                    ))}
                  </ol>
                </div>
              )}

              {reserva.status === "cancelled" ? (
                <p className="nm-puerta-aviso">
                  Reserva cancelada: no debe entrar con este código.
                </p>
              ) : (
                <div className="nm-reserva-acciones">
                  <button
                    type="button"
                    className={
                      reserva.status === "checked_in" ? "nm-admin-logout" : "nm-btn nm-btn--solid"
                    }
                    disabled={ingreso.isPending}
                    onClick={() =>
                      ingreso.mutate({
                        id: reserva.id,
                        entered: reserva.status !== "checked_in",
                      })
                    }
                  >
                    {reserva.status === "checked_in" ? "Deshacer ingreso" : "Marcar que entró"}
                  </button>
                  <button
                    type="button"
                    className={reserva.paid ? "nm-admin-logout" : "nm-btn"}
                    disabled={pago.isPending}
                    onClick={() => pago.mutate({ id: reserva.id, paid: !reserva.paid })}
                  >
                    {reserva.paid ? "Marcar como no pagado" : "Marcar como pagado"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
