import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { loginSchema, type LoginInput } from "@/schemas/admin";
import { getAdminStatus, login } from "@/actions/admin";

export const Route = createFileRoute("/admin/login")({
  beforeLoad: async () => {
    // Con sesión abierta no tiene sentido ver el login.
    const { isAdmin } = await getAdminStatus();
    if (isAdmin) {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({
    meta: [{ title: "Acceso — Nemorphic" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: LoginInput) => login({ data }),
    onSuccess: async (result) => {
      if (!result.ok) {
        form.setError("password", { message: result.message });
        form.setValue("password", "");
        return;
      }
      await router.invalidate();
      await router.navigate({ to: "/admin" });
    },
    onError: () => toast.error("No se pudo conectar. Revisa tu conexión e intenta de nuevo."),
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
        <h1 className="nm-display nm-login-title">Panel de Nemorphic</h1>
        <p className="nm-login-hint">Acceso solo para el equipo del sello.</p>

        <form
          className="nm-login-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <label htmlFor="nm-admin-password" className="nm-login-label">
            Clave de acceso
          </label>
          <input
            id="nm-admin-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            className="nm-input"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "nm-admin-password-error" : undefined}
            {...form.register("password")}
          />

          {error && (
            <p id="nm-admin-password-error" role="alert" className="nm-login-error">
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
