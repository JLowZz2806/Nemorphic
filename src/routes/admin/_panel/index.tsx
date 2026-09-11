import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  clearDoorAccessPassword,
  getDoorAccessInfo,
  listEventsSummary,
  setDoorAccessPassword,
  setFeaturedEvent,
} from "@/actions/admin-settings";
import { fechaLarga } from "@/lib/fechas";

export const Route = createFileRoute("/admin/_panel/")({
  component: Resumen,
});

function formatearMomento(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/**
 * Cuál de los eventos abiertos sale en la portada.
 *
 * Vive en el Resumen y no en Reservas porque no es una tarea del día del evento:
 * es decidir qué enseña la web, y se hace una vez por anuncio.
 */
function EventoPrincipal() {
  const queryClient = useQueryClient();

  const eventos = useQuery({
    queryKey: ["admin", "eventos"],
    queryFn: () => listEventsSummary(),
  });

  const destacar = useMutation({
    mutationFn: (slug: string) => setFeaturedEvent({ data: { slug } }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "eventos"] });
      toast.success("Cambiado: eso es lo que se ve ahora en la web");
    },
    onError: () => toast.error("No se pudo cambiar. Intenta de nuevo."),
  });

  const lista = eventos.data ?? [];
  const hayDestacado = lista.some((evento) => evento.featured);

  return (
    <section className="nm-admin-card" aria-labelledby="nm-admin-evento">
      <h2 id="nm-admin-evento" className="nm-admin-card-title">
        Evento principal
      </h2>

      <p className="nm-admin-card-texto">
        La portada muestra <strong>un solo evento</strong>, el que marques aquí. Los demás siguen
        visibles en la página <strong>Eventos</strong>, con su propio botón de reserva.
      </p>

      {eventos.isLoading && <p className="nm-admin-estado">Cargando eventos…</p>}

      {!eventos.isLoading && lista.length === 0 && (
        <p className="nm-admin-estado">
          No hay eventos con reservas abiertas. Pídele al programador que cree el siguiente y
          aparecerá aquí.
        </p>
      )}

      {lista.length > 0 && (
        <>
          <ul className="nm-admin-eventos">
            {lista.map((evento) => (
              <li key={evento.slug} className="nm-admin-evento-fila">
                <div>
                  <p className="nm-admin-evento-nombre">
                    {evento.name}
                    {evento.featured && (
                      <span className="nm-admin-evento-marca">En la portada</span>
                    )}
                  </p>
                  <p className="nm-admin-evento-fecha">{fechaLarga(evento.startsAt)}</p>
                </div>

                {!evento.featured && (
                  <button
                    type="button"
                    className="nm-admin-enlace"
                    disabled={destacar.isPending}
                    onClick={() => destacar.mutate(evento.slug)}
                  >
                    {destacar.isPending ? "Cambiando…" : "Mostrar este"}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Sin ninguno marcado la web no se rompe, pero conviene decirlo: lo que
              sale entonces es el más próximo, que puede no ser el que se quiere. */}
          {!hayDestacado && (
            <p className="nm-admin-estado">
              Ninguno está marcado, así que la portada muestra <strong>el más próximo</strong>.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AccesoPuerta() {
  const queryClient = useQueryClient();
  const [clave, setClave] = useState("");

  const info = useQuery({
    queryKey: ["admin", "puerta"],
    queryFn: () => getDoorAccessInfo(),
  });

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "puerta"] });
  };

  const guardar = useMutation({
    mutationFn: (password: string) => setDoorAccessPassword({ data: { password } }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      setClave("");
      toast.success("Clave de puerta actualizada");
    },
    onError: () => toast.error("No se pudo guardar. Intenta de nuevo."),
  });

  const cerrar = useMutation({
    mutationFn: () => clearDoorAccessPassword(),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      toast.success("Acceso de puerta cerrado");
    },
    onError: () => toast.error("No se pudo cerrar. Intenta de nuevo."),
  });

  const enlace = typeof window === "undefined" ? "/puerta" : `${window.location.origin}/puerta`;

  return (
    <section className="nm-admin-card" aria-labelledby="nm-admin-puerta">
      <h2 id="nm-admin-puerta" className="nm-admin-card-title">
        Acceso de puerta
      </h2>

      <p className="nm-admin-card-texto">
        Quien atiende la entrada abre <strong>{enlace}</strong> y usa esta clave. Puede ver todas
        las reservas y marcar quién entró y quién pagó, pero{" "}
        <strong>no puede editar nombres, entradas ni acompañantes</strong>: así nadie puede cambiar
        una reserva para colar a otra persona.
      </p>

      <p className="nm-admin-card-texto">
        Cámbiala antes de cada evento. Al cambiarla, quien estuviera dentro con la clave anterior
        queda fuera <strong>al instante</strong>, sin esperar a que caduque su sesión. «Cerrar el
        acceso» hace lo mismo y además impide entrar hasta que pongas una clave nueva.
      </p>

      {info.data && (
        <p className="nm-admin-estado">
          {info.data.configurada ? (
            <>
              Acceso <strong>activo</strong>
              {info.data.actualizada && (
                <> · clave cambiada el {formatearMomento(info.data.actualizada)}</>
              )}
            </>
          ) : (
            <>
              Acceso <strong>cerrado</strong>: nadie puede entrar a la página de puerta hasta que
              pongas una clave.
            </>
          )}
        </p>
      )}

      <form
        className="nm-admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (clave.trim().length < 6) {
            toast.error("Usa al menos 6 caracteres.");
            return;
          }
          guardar.mutate(clave.trim());
        }}
      >
        <div className="nm-campo">
          <label htmlFor="nm-clave-puerta">Nueva clave de puerta</label>
          <input
            id="nm-clave-puerta"
            type="text"
            className="nm-input"
            autoComplete="off"
            placeholder="Por ejemplo: umbra-octubre"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <p className="nm-admin-pista">
            Se la vas a dictar a alguien, así que que sea fácil de escribir. No uses la clave del
            panel.
          </p>
        </div>

        <div className="nm-admin-form-acciones">
          <button type="submit" className="nm-btn nm-btn--solid" disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar clave"}
          </button>
          {info.data?.configurada && (
            <button
              type="button"
              className="nm-admin-logout"
              disabled={cerrar.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    "¿Cerrar el acceso de puerta? Nadie podrá entrar con la clave actual.",
                  )
                ) {
                  return;
                }
                cerrar.mutate();
              }}
            >
              Cerrar el acceso
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function Resumen() {
  return (
    <>
      <h1 className="nm-admin-title">Panel de administración</h1>
      <p className="nm-admin-lead">
        Desde aquí se gestionan las reservas, las personas suscritas, el boletín, el acceso de la
        entrada y qué evento se ve en la portada.
      </p>

      <AccesoPuerta />

      <EventoPrincipal />
    </>
  );
}
