import { Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { doorLogout, getDoorStatus } from "@/actions/door";

/**
 * Layout sin segmento de URL que protege el control de entrada. El login vive
 * fuera para no entrar en bucle de redirección.
 */
export const Route = createFileRoute("/puerta/_lista")({
  beforeLoad: async () => {
    const { autorizado } = await getDoorStatus();
    if (!autorizado) {
      throw redirect({ to: "/puerta/login" });
    }
  },
  head: () => ({
    meta: [{ title: "Entrada — Nemorphic" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LayoutPuerta,
});

function LayoutPuerta() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const cerrarSesion = async () => {
    setSaliendo(true);
    try {
      await doorLogout();
      await router.invalidate();
      await router.navigate({ to: "/puerta/login" });
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
            <span>Entrada</span>
          </div>

          <button
            type="button"
            className="nm-admin-logout"
            style={{ marginLeft: "auto" }}
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
