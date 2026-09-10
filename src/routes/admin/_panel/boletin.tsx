import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  crearCampana,
  enviarLoteCampana,
  enviarPrueba,
  getEstadoCorreo,
  listarCampanas,
  previsualizarBoletin,
  probarConexionCorreo,
} from "@/actions/newsletter-admin";
import { boletinSchema, type BoletinInput } from "@/schemas/newsletter";

export const Route = createFileRoute("/admin/_panel/boletin")({
  component: Boletin,
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

type Progreso = { enviados: number; fallidos: number; restantes: number };

function Boletin() {
  const queryClient = useQueryClient();
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [correoPrueba, setCorreoPrueba] = useState("");
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [enviando, setEnviando] = useState(false);

  const estado = useQuery({ queryKey: ["admin", "correo"], queryFn: () => getEstadoCorreo() });
  const historial = useQuery({ queryKey: ["admin", "campanas"], queryFn: () => listarCampanas() });

  const form = useForm<BoletinInput>({
    resolver: zodResolver(boletinSchema),
    defaultValues: { subject: "", body: "", nombreEjemplo: "" },
  });

  const conexion = useMutation({
    mutationFn: () => probarConexionCorreo(),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success("Conexión con Gmail correcta");
    },
    onError: () => toast.error("No se pudo comprobar la conexión."),
  });

  const previa = useMutation({
    mutationFn: (data: BoletinInput) => previsualizarBoletin({ data }),
    onSuccess: (r) => setVistaPrevia(r.html),
    onError: () => toast.error("No se pudo generar la vista previa."),
  });

  const prueba = useMutation({
    mutationFn: (data: BoletinInput & { to: string }) => enviarPrueba({ data }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(
        r.esSuscriptor
          ? `Prueba enviada a ${correoPrueba}. Su enlace de baja es el real: si lo pulsas, te das de baja de verdad.`
          : `Prueba enviada a ${correoPrueba}.`,
      );
    },
    onError: () => toast.error("No se pudo enviar la prueba."),
  });

  /**
   * Envía en bucle: cada llamada manda un lote pequeño y dice cuántos quedan.
   * Vercel corta las funciones largas, así que el bucle vive aquí, en el
   * navegador, y así además se puede mostrar el progreso.
   */
  const enviarTodo = async (valores: BoletinInput) => {
    const creada = await crearCampana({ data: valores });
    if (!creada.ok) {
      toast.error(creada.message);
      return;
    }

    setEnviando(true);
    setProgreso({ enviados: 0, fallidos: 0, restantes: estado.data?.suscritos ?? 0 });

    try {
      for (;;) {
        const paso = await enviarLoteCampana({ data: { id: creada.id } });

        if (!paso.ok) {
          toast.error(paso.message);
          break;
        }

        setProgreso({
          enviados: paso.enviados,
          fallidos: paso.fallidos,
          restantes: paso.restantes,
        });

        for (const fallo of paso.errores) {
          toast.error(`No salió a ${fallo.email}`);
        }

        if (paso.restantes === 0) {
          toast.success(
            paso.fallidos > 0
              ? `Enviado a ${paso.enviados}, con ${paso.fallidos} fallo(s).`
              : `Boletín enviado a ${paso.enviados} persona(s).`,
          );
          form.reset();
          break;
        }
      }
    } catch {
      toast.error(
        "Se interrumpió el envío. Vuelve a intentarlo: no se repetirá a quien ya recibió.",
      );
    } finally {
      setEnviando(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "campanas"] });
    }
  };

  const suscritos = estado.data?.suscritos ?? 0;
  const configurado = estado.data?.configurado ?? false;

  return (
    <>
      <h1 className="nm-admin-title">Boletín</h1>
      <p className="nm-admin-lead">
        Un correo a las personas suscritas. Cada una lo recibe <strong>con su nombre</strong> en el
        saludo; el resto del mensaje es igual para todas.
      </p>

      {estado.isSuccess && !configurado && (
        <p className="nm-admin-estado">
          El envío de correo <strong>no está configurado</strong>. Faltan las variables
          <code> EMAIL_FROM</code> y <code>EMAIL_APP_PASSWORD</code>. Avisa al desarrollador.
        </p>
      )}

      <dl className="nm-admin-resumen">
        <div className="nm-admin-dato">
          <dt>Recibirán este correo</dt>
          <dd>{suscritos}</dd>
        </div>
        <div className="nm-admin-dato">
          <dt>Conexión</dt>
          <dd style={{ fontSize: "1rem" }}>
            <button
              type="button"
              className="nm-admin-enlace"
              disabled={conexion.isPending || !configurado}
              onClick={() => conexion.mutate()}
            >
              {conexion.isPending ? "Comprobando…" : "Probar conexión"}
            </button>
          </dd>
        </div>
      </dl>

      <form className="nm-admin-form" onSubmit={form.handleSubmit(enviarTodo)} noValidate>
        <div className="nm-campo">
          <label htmlFor="nm-bol-asunto">Asunto</label>
          <input
            id="nm-bol-asunto"
            type="text"
            className="nm-input"
            placeholder="Nueva sesión disponible: Nemorphic Sessions 018"
            {...form.register("subject")}
          />
          {form.formState.errors.subject && (
            <p role="alert">{form.formState.errors.subject.message}</p>
          )}
        </div>

        <div className="nm-campo">
          <label htmlFor="nm-bol-cuerpo">Mensaje</label>
          <textarea
            id="nm-bol-cuerpo"
            className="nm-input nm-textarea"
            rows={10}
            placeholder={"Escribe aquí.\n\nDeja una línea en blanco para separar párrafos."}
            {...form.register("body")}
          />
          {form.formState.errors.body && <p role="alert">{form.formState.errors.body.message}</p>}
          <p className="nm-admin-pista">
            Texto normal. No escribas el saludo: se añade solo con el nombre de cada persona.
          </p>
        </div>

        <div className="nm-admin-form-acciones">
          <button
            type="button"
            className="nm-admin-logout"
            disabled={previa.isPending}
            onClick={() => {
              const valores = form.getValues();
              if (!valores.subject.trim() || valores.body.trim().length < 20) {
                toast.error("Escribe el asunto y el mensaje antes de previsualizar.");
                return;
              }
              previa.mutate(valores);
            }}
          >
            {previa.isPending ? "Generando…" : "Ver cómo queda"}
          </button>
        </div>

        <fieldset className="nm-acompanantes">
          <legend>Enviarme una prueba primero</legend>
          <div className="nm-campo">
            <label htmlFor="nm-bol-prueba">Tu correo</label>
            <input
              id="nm-bol-prueba"
              type="email"
              className="nm-input"
              value={correoPrueba}
              onChange={(e) => setCorreoPrueba(e.target.value)}
            />
            <p className="nm-admin-pista">
              Llega solo a esta dirección, con [PRUEBA] en el asunto. No toca la lista. Si esa
              dirección está suscrita, el correo va con su nombre y su enlace de baja reales, para
              que la prueba sea idéntica a lo que recibirá la gente.
            </p>
            <p className="nm-admin-pista">
              <strong>Búscalo también en Promociones y en Spam.</strong> Gmail suele archivar ahí
              los boletines la primera vez.
            </p>
          </div>
          <button
            type="button"
            className="nm-admin-logout"
            disabled={prueba.isPending || !configurado}
            onClick={() => {
              const valores = form.getValues();
              if (!correoPrueba.includes("@")) {
                toast.error("Escribe una dirección de correo válida.");
                return;
              }
              if (!valores.subject.trim() || valores.body.trim().length < 20) {
                toast.error("Escribe el asunto y el mensaje antes de mandar la prueba.");
                return;
              }
              prueba.mutate({ ...valores, to: correoPrueba });
            }}
          >
            {prueba.isPending ? "Enviando…" : "Enviar prueba"}
          </button>
        </fieldset>

        {progreso && (
          <div className="nm-admin-estado">
            Enviados <strong>{progreso.enviados}</strong>
            {progreso.fallidos > 0 && <> · fallidos {progreso.fallidos}</>}
            {progreso.restantes > 0 ? <> · quedan {progreso.restantes}</> : <> · terminado</>}
          </div>
        )}

        <div className="nm-admin-form-acciones">
          <button
            type="submit"
            className="nm-btn nm-btn--solid"
            disabled={enviando || !configurado || suscritos === 0}
            onClick={(e) => {
              const valores = form.getValues();
              if (!valores.subject.trim() || valores.body.trim().length < 20) return;
              if (
                !window.confirm(
                  `Se enviará este boletín a ${suscritos} persona(s). Esto no se puede deshacer.\n\n` +
                    "¿Mandaste ya una prueba a tu correo y la revisaste?",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            {enviando ? "Enviando…" : `Enviar a ${suscritos} persona(s)`}
          </button>
        </div>
      </form>

      {vistaPrevia && (
        <section className="nm-admin-card">
          <h2 className="nm-admin-card-title">Así llegará</h2>
          <p className="nm-admin-card-texto">
            Donde dice «Nombre de la persona» irá el nombre real de cada suscriptor.
          </p>
          <iframe
            title="Vista previa del boletín"
            srcDoc={vistaPrevia}
            className="nm-boletin-previa"
          />
          <div className="nm-admin-form-acciones">
            <button type="button" className="nm-admin-logout" onClick={() => setVistaPrevia(null)}>
              Cerrar vista previa
            </button>
          </div>
        </section>
      )}

      <section className="nm-admin-card">
        <h2 className="nm-admin-card-title">Boletines enviados</h2>
        {historial.data && historial.data.length > 0 ? (
          <ul className="nm-admin-list">
            {historial.data.map((c) => (
              <li key={c.id}>
                <strong>{c.subject}</strong>
                <span>
                  {c.sentAt ? formatearMomento(c.sentAt) : formatearMomento(c.createdAt)} ·{" "}
                  {c.enviados} enviado(s)
                  {c.fallidos > 0 && ` · ${c.fallidos} fallido(s)`}
                  {c.status !== "sent" && " · sin terminar"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nm-admin-card-texto">Todavía no se ha enviado ningún boletín.</p>
        )}
      </section>
    </>
  );
}
