import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { subscribe } from "@/actions/newsletter";
import { subscribeSchema, type SubscribeInput } from "@/schemas/newsletter";

export function NewsletterForm() {
  const [suscrito, setSuscrito] = useState<string | null>(null);

  const form = useForm<SubscribeInput>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { name: "", email: "", website: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: SubscribeInput) => subscribe({ data }),
    onSuccess: (resultado, variables) => {
      if (!resultado.ok) {
        form.setError("root", { message: resultado.message });
        return;
      }
      setSuscrito(variables.name);
      form.reset();
    },
    onError: () => {
      form.setError("root", {
        message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo.",
      });
    },
  });

  if (suscrito) {
    return (
      <div className="nm-newsletter-ok">
        <p className="nm-body-text">
          Gracias, <strong>{suscrito}</strong>. Te escribiremos cuando haya sesión, lanzamiento o
          evento nuevo.
        </p>
        <p className="nm-newsletter-aviso">
          <strong>Un favor:</strong> si usas Gmail, nuestro primer correo suele caer en la pestaña
          <em> Promociones</em>. Arrástralo a <em>Principal</em> y no se te volverá a escapar.
        </p>
      </div>
    );
  }

  const errores = form.formState.errors;

  return (
    <form
      className="nm-newsletter-form"
      onSubmit={form.handleSubmit((valores) => mutation.mutate(valores))}
      noValidate
    >
      <div className="nm-campo">
        <label htmlFor="nm-news-nombre">Tu nombre</label>
        <input
          id="nm-news-nombre"
          type="text"
          autoComplete="given-name"
          className="nm-input"
          {...form.register("name")}
        />
        {errores.name && <p role="alert">{errores.name.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-news-correo">Tu correo</label>
        <input
          id="nm-news-correo"
          type="email"
          autoComplete="email"
          className="nm-input"
          {...form.register("email")}
        />
        {errores.email && <p role="alert">{errores.email.message}</p>}
      </div>

      {/* Campo trampa para bots: invisible y fuera del recorrido de teclado. */}
      <div className="nm-trampa" aria-hidden="true">
        <label htmlFor="nm-news-website">No rellenes este campo</label>
        <input id="nm-news-website" type="text" tabIndex={-1} {...form.register("website")} />
      </div>

      {errores.root && (
        <p role="alert" className="nm-reserva-error">
          {errores.root.message}
        </p>
      )}

      <button
        type="submit"
        className="nm-btn nm-btn--solid nm-newsletter-enviar"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Suscribiendo…" : "Suscribirme"}
      </button>
    </form>
  );
}
