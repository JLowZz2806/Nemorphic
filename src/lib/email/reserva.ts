/**
 * Envío de la confirmación de una reserva.
 *
 * Vive aparte de las acciones porque lo usan las dos vías que crean reservas: el
 * formulario público y el alta a mano del panel, que es la de quien pide el cupo
 * por WhatsApp o por Instagram. Esa persona necesita su código igual que
 * cualquiera, y dictárselo a mano es justo lo que se quería evitar.
 */

export type DatosConfirmacion = {
  para: string;
  nombre: string;
  codigo: string;
  evento: string;
  eslogan: string | null;
  inicio: string | null;
  lugar: string | null;
  entradas: number;
};

/**
 * Manda la confirmación con el código de entrada.
 *
 * **Nunca lanza.** La reserva ya está guardada y es lo que importa: si el correo
 * falla, el código sigue en pantalla y en `/admin/reservas`. Devuelve si salió,
 * para que quien llame no prometa un correo que no existe.
 */
export async function enviarConfirmacionDeReserva(datos: DatosConfirmacion): Promise<boolean> {
  try {
    const { isEmailConfigured, enviarCorreo } = await import("./provider");

    if (!isEmailConfigured()) {
      console.error(
        "enviarConfirmacionDeReserva: faltan EMAIL_FROM o EMAIL_APP_PASSWORD, no se envió nada.",
      );
      return false;
    }

    const plantillas = await import("./templates");
    const contenido = {
      nombre: datos.nombre,
      codigo: datos.codigo,
      evento: datos.evento,
      eslogan: datos.eslogan,
      inicio: datos.inicio,
      lugar: datos.lugar,
      entradas: datos.entradas,
    };

    await enviarCorreo({
      to: datos.para,
      subject: plantillas.asuntoReserva(contenido),
      html: plantillas.renderReservaHtml(contenido),
      text: plantillas.renderReservaTexto(contenido),
      // Sin List-Unsubscribe a propósito: es transaccional, no boletín.
    });

    return true;
  } catch (error) {
    console.error("enviarConfirmacionDeReserva:", error);
    return false;
  }
}
