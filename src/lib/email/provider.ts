import { env } from "node:process";

import nodemailer, { type Transporter } from "nodemailer";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Si viene, se añade la cabecera List-Unsubscribe con este enlace. */
  unsubscribeUrl?: string;
};

export type EnvioResultado = {
  to: string;
  /** `null` si salió bien; si no, el motivo, para poder reintentar solo esos. */
  error: string | null;
};

/**
 * Envío por el SMTP de Gmail con una App Password.
 *
 * Es lo que mejor llega mientras no haya dominio propio: el correo lo manda
 * Google de verdad, así que pasa DKIM y SPF correctamente. Un proveedor externo
 * enviando "en nombre de" ese Gmail no puede alinear DKIM, y ahí empiezan los
 * problemas de spam.
 *
 * Al comprar dominio, migrar a Resend es reescribir solo este archivo.
 */

/** Extrae la dirección de un remitente con formato `Nombre <correo@dominio>`. */
function direccionDe(remitente: string): string {
  const entreAngulos = /<([^>]+)>/.exec(remitente);
  return (entreAngulos?.[1] ?? remitente).trim();
}

export function isEmailConfigured(): boolean {
  return Boolean(env["EMAIL_FROM"] && env["EMAIL_APP_PASSWORD"]);
}

let transporter: Transporter | undefined;

function getTransporter(): { transporter: Transporter; from: string } {
  const from = env["EMAIL_FROM"];
  // Google muestra la App Password en cuatro grupos de cuatro. Si se copia con
  // los espacios, la autenticacion falla con un error que no explica nada, así
  // que se limpian aquí.
  const password = env["EMAIL_APP_PASSWORD"]?.replace(/\s+/g, "");

  if (!from || !password) {
    throw new Error(
      "Faltan EMAIL_FROM o EMAIL_APP_PASSWORD. En local van en .env; en producción, " +
        "en las variables de entorno de Vercel.",
    );
  }

  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: direccionDe(from), pass: password },
    // Una sola conexión reutilizada para todo el lote: abrir una por correo es
    // lento y Gmail lo penaliza.
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
  });

  return { transporter, from };
}

/** Comprueba que las credenciales son válidas, sin enviar nada. */
export async function verificarConexion(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { transporter: t } = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "error desconocido" };
  }
}

export async function enviarCorreo(mensaje: EmailMessage): Promise<void> {
  const { transporter: t, from } = getTransporter();

  await t.sendMail({
    from,
    to: mensaje.to,
    subject: mensaje.subject,
    text: mensaje.text,
    html: mensaje.html,
    ...(mensaje.unsubscribeUrl
      ? { headers: { "List-Unsubscribe": `<${mensaje.unsubscribeUrl}>` } }
      : {}),
  });
}

/**
 * Envía un lote, **un correo por destinatario**.
 *
 * Nunca en copia oculta: eso filtraría la lista completa de correos a cada
 * persona que lo reciba, y además dispara los filtros de spam.
 *
 * No se detiene si uno falla; devuelve el resultado de cada uno para poder
 * registrar quién lo recibió y reintentar solo los fallidos.
 */
export async function enviarLote(
  mensajes: ReadonlyArray<EmailMessage>,
): Promise<Array<EnvioResultado>> {
  const resultados: Array<EnvioResultado> = [];

  for (const mensaje of mensajes) {
    try {
      await enviarCorreo(mensaje);
      resultados.push({ to: mensaje.to, error: null });
    } catch (error) {
      console.error("enviarLote:", mensaje.to, error);
      resultados.push({
        to: mensaje.to,
        error: error instanceof Error ? error.message : "error desconocido",
      });
    }
  }

  return resultados;
}
