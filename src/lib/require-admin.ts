/**
 * Guarda de sesión compartida por todas las server functions del panel.
 *
 * `beforeLoad` protege la navegación, pero no la API: cualquiera puede llamar a
 * una server function con `fetch` sin pasar por la página. Por eso cada acción
 * del panel empieza llamando a esta función.
 *
 * Lanza en vez de devolver un booleano para que olvidarse de comprobar el
 * resultado no deje una acción desprotegida.
 */
export async function requireAdmin(): Promise<void> {
  const { isAdmin } = await import("@/lib/auth");

  if (!(await isAdmin())) {
    throw new Error("No autorizado");
  }
}
