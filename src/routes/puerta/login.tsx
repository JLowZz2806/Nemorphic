import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { doorLogin, getDoorStatus } from "@/actions/door";
import { loginSchema, type LoginInput } from "@/schemas/admin";

export const Route = createFileRoute("/puerta/login")({
  beforeLoad: async () => {
    const { autorizado } = await getDoorStatus();
    if (autorizado) {
      throw redirect({ to: "/puerta" });
    }
  },
  head: () => ({
    meta: [{ title: "Entrada — Nemorphic" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPuerta,
});

function LoginPuerta() {
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: LoginInput) => doorLogin({ data }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        form.setError("password", { message: resultado.message });
        form.setValue("password", "");
        return;
      }
      await router.invalidate();
      await router.navigate({ to: "/puerta" });
    },
    onError: () => toast.error("No se pudo conectar. Revisa la señal e intenta de nuevo."),
  });

  const error = form.formState.errors.password?.message;

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
        <h1 className="nm-display nm-login-title">Entrada</h1>
        <p className="nm-login-hint">
          Control de acceso al evento. Pide la clave al equipo de Nemorphic.
        </p>

        <form
          className="nm-login-form"
          onSubmit={form.handleSubmit((valores) => mutation.mutate(valores))}
          noValidate
        >
          <label htmlFor="nm-puerta-password" className="nm-login-label">
            Clave del evento
          </label>
          <input
            id="nm-puerta-password"
            type="password"
            autoComplete="off"
            autoFocus
            className="nm-input"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "nm-puerta-password-error" : undefined}
            {...form.register("password")}
          />

          {error && (
            <p id="nm-puerta-password-error" role="alert" className="nm-login-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="nm-btn nm-btn--solid nm-login-submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Comprobando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
