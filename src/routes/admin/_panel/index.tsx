import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  clearDoorAccessPassword,
  getDoorAccessInfo,
  setDoorAccessPassword,
} from "@/actions/admin-settings";

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

/** Lo que falta por construir, para que el equipo sepa qué esperar. */
const proximo = [
  { titulo: "Eventos", detalle: "Crear y editar eventos desde aquí, sin pasar por el código." },
  { titulo: "Boletín", detalle: "Redactar y enviar un correo a quienes estén suscritos." },
];

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
        Cámbiala antes de cada evento. Al cambiarla, quien tuviera la anterior queda fuera en su
        siguiente visita.
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
        Desde aquí se gestionan las reservas, las personas suscritas y el acceso de la entrada.
      </p>

      <AccesoPuerta />

      <section className="nm-admin-card" aria-labelledby="nm-admin-proximo">
        <h2 id="nm-admin-proximo" className="nm-admin-card-title">
          En construcción
        </h2>
        <ul className="nm-admin-list">
          {proximo.map((item) => (
            <li key={item.titulo}>
              <strong>{item.titulo}</strong>
              <span>{item.detalle}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
