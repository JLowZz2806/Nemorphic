/**
 * Guardas de sesión para las server functions.
 *
 * `beforeLoad` protege la navegación, pero no la API: cualquiera puede llamar a
 * una server function con `fetch` sin pasar por la página. Por eso cada acción
 * empieza llamando a la guarda que le corresponde.
 *
 * Lanzan en vez de devolver un booleano para que olvidarse de comprobar el
 * resultado no deje una acción desprotegida.
 */

/** Solo el equipo del sello. Rechaza incluso una sesión de puerta válida. */
export async function requireAdmin(): Promise<void> {
  const { isAdmin } = await import("@/lib/auth");

  if (!(await isAdmin())) {
    throw new Error("No autorizado");
  }
}

/**
 * Para lo que la puerta también puede hacer: marcar ingreso y pago.
 *
 * Devuelve desde dónde se actuó, que se guarda en la reserva para poder cuadrar
 * la caja después y ver qué se marcó en la entrada y qué desde el panel.
 */
export async function requireDoorOrAdmin(): Promise<"admin" | "door"> {
  const { isAdmin, isDoor } = await import("@/lib/auth");

  if (await isAdmin()) return "admin";
  if (await isDoor()) return "door";

  throw new Error("No autorizado");
}
