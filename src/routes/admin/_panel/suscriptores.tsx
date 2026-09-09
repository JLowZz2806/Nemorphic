import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createSubscriber,
  deleteSubscriber,
  listSubscribers,
  updateSubscriber,
  type SuscriptorAdmin,
} from "@/actions/admin-subscribers";
import { adminSubscriberSchema, type AdminSubscriberInput } from "@/schemas/newsletter";

export const Route = createFileRoute("/admin/_panel/suscriptores")({
  component: Suscriptores,
});

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/** Formulario compartido por el alta y la edición. */
function FormularioSuscriptor({
  inicial,
  enviando,
  onGuardar,
  onCancelar,
  textoBoton,
}: {
  inicial: AdminSubscriberInput;
  enviando: boolean;
  onGuardar: (valores: AdminSubscriberInput) => void;
  onCancelar: () => void;
  textoBoton: string;
}) {
  const form = useForm<AdminSubscriberInput>({
    resolver: zodResolver(adminSubscriberSchema),
    defaultValues: inicial,
  });
  const errores = form.formState.errors;

  return (
    <form className="nm-admin-form" onSubmit={form.handleSubmit(onGuardar)} noValidate>
      <div className="nm-campo">
        <label htmlFor="nm-sub-nombre">Nombre</label>
        <input id="nm-sub-nombre" type="text" className="nm-input" {...form.register("name")} />
        {errores.name && <p role="alert">{errores.name.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-sub-correo">Correo</label>
        <input id="nm-sub-correo" type="email" className="nm-input" {...form.register("email")} />
        {errores.email && <p role="alert">{errores.email.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-sub-estado">Estado</label>
        <select id="nm-sub-estado" className="nm-input" {...form.register("status")}>
          <option value="active">Recibe correos</option>
          <option value="unsubscribed">Dado de baja</option>
        </select>
      </div>

      <div className="nm-admin-form-acciones">
        <button type="submit" className="nm-btn nm-btn--solid" disabled={enviando}>
          {enviando ? "Guardando…" : textoBoton}
        </button>
        <button type="button" className="nm-admin-logout" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Suscriptores() {
  const queryClient = useQueryClient();
  const [anadiendo, setAnadiendo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const consulta = useQuery({
    queryKey: ["admin", "suscriptores"],
    queryFn: () => listSubscribers(),
  });

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "suscriptores"] });
  };

  const alta = useMutation({
    mutationFn: (data: AdminSubscriberInput) => createSubscriber({ data }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      setAnadiendo(false);
      toast.success("Persona añadida a la lista");
    },
    onError: () => toast.error("No se pudo añadir. Intenta de nuevo."),
  });

  const edicion = useMutation({
    mutationFn: (data: AdminSubscriberInput & { id: string }) => updateSubscriber({ data }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      setEditando(null);
      toast.success("Cambios guardados");
    },
    onError: () => toast.error("No se pudo guardar. Intenta de nuevo."),
  });

  const borrado = useMutation({
    mutationFn: (id: string) => deleteSubscriber({ data: { id } }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      toast.success("Persona eliminada");
    },
    onError: () => toast.error("No se pudo eliminar. Intenta de nuevo."),
  });

  if (consulta.isLoading) {
    return (
      <>
        <h1 className="nm-admin-title">Personas suscritas</h1>
        <p className="nm-admin-lead">Cargando…</p>
      </>
    );
  }

  if (consulta.isError) {
    return (
      <>
        <h1 className="nm-admin-title">Personas suscritas</h1>
        <p className="nm-admin-lead">
          No se pudieron cargar. Recarga la página; si sigue fallando, puede que falte aplicar la
          migración <code>0002_suscriptores_nombre.sql</code> en Supabase.
        </p>
      </>
    );
  }

  const todos = consulta.data ?? [];
  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? todos.filter(
        (s) =>
          (s.name ?? "").toLowerCase().includes(termino) || s.email.toLowerCase().includes(termino),
      )
    : todos;
  const activos = todos.filter((s) => s.status === "active").length;

  return (
    <>
      <h1 className="nm-admin-title">Personas suscritas</h1>
      <p className="nm-admin-lead">
        Quienes recibirán el boletín. Puedes añadir a alguien a mano si te lo pide por WhatsApp.
      </p>

      <dl className="nm-admin-resumen">
        <div className="nm-admin-dato">
          <dt>Reciben correos</dt>
          <dd>{activos}</dd>
        </div>
        <div className="nm-admin-dato">
          <dt>Dados de baja</dt>
          <dd>{todos.length - activos}</dd>
        </div>
      </dl>

      <div className="nm-admin-toolbar">
        <input
          type="search"
          className="nm-input"
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar suscriptor"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {!anadiendo && (
          <button type="button" className="nm-btn nm-btn--solid" onClick={() => setAnadiendo(true)}>
            Añadir persona
          </button>
        )}
      </div>

      {anadiendo && (
        <FormularioSuscriptor
          inicial={{ name: "", email: "", status: "active" }}
          enviando={alta.isPending}
          textoBoton="Añadir"
          onGuardar={(valores) => alta.mutate(valores)}
          onCancelar={() => setAnadiendo(false)}
        />
      )}

      {visibles.length === 0 ? (
        <p className="nm-admin-vacio">
          {todos.length === 0
            ? "Todavía no hay nadie suscrito. Cuando alguien se apunte desde la web, aparecerá aquí."
            : "Ningún resultado para esa búsqueda."}
        </p>
      ) : (
        <div className="nm-reserva-lista">
          {visibles.map((suscriptor: SuscriptorAdmin) => (
            <article className="nm-reserva-item" key={suscriptor.id}>
              {editando === suscriptor.id ? (
                <FormularioSuscriptor
                  inicial={{
                    name: suscriptor.name ?? "",
                    email: suscriptor.email,
                    status: suscriptor.status,
                  }}
                  enviando={edicion.isPending}
                  textoBoton="Guardar cambios"
                  onGuardar={(valores) => edicion.mutate({ ...valores, id: suscriptor.id })}
                  onCancelar={() => setEditando(null)}
                />
              ) : (
                <>
                  <div className="nm-reserva-cabecera">
                    <span className="nm-reserva-nombre">{suscriptor.name ?? "Sin nombre"}</span>
                    <span className={`nm-etiqueta nm-etiqueta--${suscriptor.status}`}>
                      {suscriptor.status === "active" ? "Recibe correos" : "Dado de baja"}
                    </span>
                    <span className="nm-reserva-entradas">
                      Desde {formatearFecha(suscriptor.createdAt)}
                    </span>
                  </div>

                  <div className="nm-reserva-contacto">
                    <a href={`mailto:${suscriptor.email}`}>{suscriptor.email}</a>
                  </div>

                  <div className="nm-reserva-acciones">
                    <button
                      type="button"
                      className="nm-admin-logout"
                      onClick={() => setEditando(suscriptor.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="nm-admin-logout"
                      disabled={borrado.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `¿Eliminar a ${suscriptor.name ?? suscriptor.email} de la lista? No se puede deshacer.`,
                          )
                        ) {
                          return;
                        }
                        borrado.mutate(suscriptor.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
