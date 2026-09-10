import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { unsubscribe } from "@/actions/unsubscribe";

/**
 * Baja del boletín desde el enlace del correo: `/baja?token=<uuid>`.
 *
 * Pide **confirmación explícita** en vez de dar de baja al abrir. No es fricción
 * gratuita: los antivirus corporativos y los escáneres de enlaces visitan lo que
 * llega por correo, y algunos ejecutan JavaScript. Sin un clic de por medio,
 * perderíamos suscriptores que nunca pidieron irse, y en silencio.
 */
export const Route = createFileRoute("/baja")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Baja del boletín — Nemorphic" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Baja,
});

function Baja() {
  const { token } = Route.useSearch();

  const mutation = useMutation({
    mutationFn: (valor: string) => unsubscribe({ data: { token: valor } }),
  });

  return (
    <div className="nm-login">
      <div className="nm-login-card nm-grain">
        <img
          src="/Assets/logo nemorphic.png"
          alt="Nemorphic"
          width={64}
          height={64}
          className="nm-login-logo"
        />
        <Contenido token={token} mutation={mutation} />
      </div>
    </div>
  );
}

type Mutacion = ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof unsubscribe>>, Error, string>
>;

function Contenido({ token, mutation }: { token: string | undefined; mutation: Mutacion }) {
  if (!token) {
    return (
      <>
        <h1 className="nm-display nm-login-title">Enlace incompleto</h1>
        <p className="nm-body-text nm-baja-texto">
          Este enlace no trae la información necesaria. Ábrelo directamente desde el correo que
          recibiste.
        </p>
        <a href="/" className="nm-btn nm-baja-volver">
          Ir a la web
        </a>
      </>
    );
  }

  const resultado = mutation.data;

  if (resultado?.ok) {
    return (
      <>
        <h1 className="nm-display nm-login-title">Listo</h1>
        <p className="nm-body-text nm-baja-texto">
          Hemos dado de baja a <strong>{resultado.email}</strong>. No volverás a recibir nuestros
          correos.
        </p>
        <p className="nm-baja-nota">
          Si cambias de idea, puedes volver a suscribirte desde la web cuando quieras.
        </p>
        <a href="/" className="nm-btn nm-btn--solid nm-baja-volver">
          Volver a la web
        </a>
      </>
    );
  }

  if (resultado?.motivo === "token-de-ejemplo") {
    return (
      <>
        <h1 className="nm-display nm-login-title">Enlace de ejemplo</h1>
        <p className="nm-body-text nm-baja-texto">
          Este correo era una <strong>prueba</strong>, así que su enlace de baja no da de baja a
          nadie. En el boletín real, aquí se daría de baja quien lo recibió.
        </p>
        <a href="/" className="nm-btn nm-baja-volver">
          Volver a la web
        </a>
      </>
    );
  }

  if (resultado?.motivo === "token-invalido") {
    return (
      <>
        <h1 className="nm-display nm-login-title">Enlace no válido</h1>
        <p className="nm-body-text nm-baja-texto">
          Puede que ya te hubieras dado de baja, o que el enlace esté incompleto. Si sigues
          recibiendo correos, escríbenos y lo resolvemos.
        </p>
        <a href="/" className="nm-btn nm-baja-volver">
          Volver a la web
        </a>
      </>
    );
  }

  return (
    <>
      <h1 className="nm-display nm-login-title">¿Dejar de recibir el boletín?</h1>
      <p className="nm-body-text nm-baja-texto">
        Dejarás de recibir los correos de Nemorphic sobre sesiones, lanzamientos y eventos.
      </p>

      {(mutation.isError || resultado?.motivo === "error") && (
        <p role="alert" className="nm-reserva-error nm-baja-texto">
          No pudimos procesar tu baja ahora mismo. Vuelve a intentarlo en un rato.
        </p>
      )}

      <button
        type="button"
        className="nm-btn nm-btn--solid nm-baja-volver"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(token)}
      >
        {mutation.isPending ? "Dando de baja…" : "Sí, darme de baja"}
      </button>

      <p className="nm-baja-nota">
        <a href="/">No, quiero seguir recibiéndolos</a>
      </p>
    </>
  );
}
