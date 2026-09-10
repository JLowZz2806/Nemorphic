import { Link, Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { getAdminStatus, logout } from "@/actions/admin";

/**
 * Layout sin segmento de URL (`_panel`) que protege todo lo que cuelga de él.
 * El login vive fuera a propósito: si estuviera dentro, la redirección al login
 * entraría en bucle.
 */
export const Route = createFileRoute("/admin/_panel")({
  beforeLoad: async () => {
    const { isAdmin } = await getAdminStatus();
    if (!isAdmin) {
      throw redirect({ to: "/admin/login" });
    }
  },
  head: () => ({
    meta: [{ title: "Panel — Nemorphic" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PanelLayout,
});

const secciones = [
  { to: "/admin", label: "Resumen" },
  { to: "/admin/reservas", label: "Reservas" },
  { to: "/admin/suscriptores", label: "Suscriptores" },
  { to: "/admin/boletin", label: "Boletín" },
] as const;

function PanelLayout() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const cerrarSesion = async () => {
    setSaliendo(true);
    try {
      await logout();
      await router.invalidate();
      await router.navigate({ to: "/admin/login" });
    } catch {
      toast.error("No se pudo cerrar la sesión. Recarga la página.");
      setSaliendo(false);
    }
  };

  return (
    <div className="nm-admin">
      <header className="nm-admin-bar">
        <div className="nm-admin-bar-inner">
          <div className="nm-admin-brand">
            <img
              src="/Assets/logo nemorphic.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
            />
            <span>Panel de Nemorphic</span>
          </div>

          <nav className="nm-admin-nav" aria-label="Secciones del panel">
            {secciones.map((seccion) => (
              <Link
                key={seccion.to}
                to={seccion.to}
                className="nm-admin-nav-link"
                activeProps={{ className: "nm-admin-nav-link is-active" }}
                activeOptions={{ exact: true }}
              >
                {seccion.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="nm-admin-logout"
            onClick={cerrarSesion}
            disabled={saliendo}
          >
            {saliendo ? "Saliendo…" : "Cerrar sesión"}
          </button>
        </div>
      </header>

      <main className="nm-admin-main">
        <Outlet />
      </main>
    </div>
  );
}
