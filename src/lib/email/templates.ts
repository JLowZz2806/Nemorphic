import { env } from "node:process";

/**
 * Plantilla del boletín.
 *
 * No reutiliza `src/styles.css` a propósito: Gmail y Outlook eliminan las hojas
 * externas, no entienden variables CSS y Outlook de escritorio renderiza con el
 * motor de Word. Todo va en línea, con tablas, y los colores literales copiados
 * de los tokens del sitio.
 */

const COLOR = {
  fondo: "#050308",
  panel: "#0b0611",
  texto: "#ffffff",
  suave: "rgba(255,255,255,0.62)",
  tenue: "rgba(255,255,255,0.40)",
  acento: "#d29ccc",
  violeta: "#3f1580",
  borde: "rgba(255,255,255,0.10)",
} as const;

// DM Serif Display no se carga en la mayoría de clientes de correo. Georgia es
// el mismo fallback que ya declara --nm-font-display y mantiene el aire editorial.
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "Arial, Helvetica, sans-serif";

export function getSiteUrl(): string {
  return (env["SITE_URL"] ?? "https://nemorphic.vercel.app").replace(/\/+$/, "");
}

/**
 * Escapa el texto que escribió el equipo antes de meterlo en el HTML.
 *
 * Sin esto, un `<` cualquiera rompe el correo, y pegar algo con HTML dejaría
 * inyectar contenido arbitrario en el mensaje que reciben los suscriptores.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convierte el texto plano del panel en párrafos, respetando las líneas en blanco. */
function aParrafos(cuerpo: string): string {
  return cuerpo
    .split(/\n{2,}/)
    .map((bloque) => bloque.trim())
    .filter(Boolean)
    .map(
      (bloque) =>
        `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.7;color:${COLOR.texto};">` +
        escapar(bloque).replace(/\n/g, "<br />") +
        `</p>`,
    )
    .join("");
}

/** Saludo con el nombre. La columna es nullable, así que hay que contemplarlo. */
function saludo(nombre: string | null): string {
  const limpio = nombre?.trim();
  return limpio ? `Hola, ${escapar(limpio)}.` : "Hola.";
}

export type BoletinDatos = {
  nombre: string | null;
  asunto: string;
  cuerpo: string;
  unsubscribeUrl: string;
  /**
   * Añade la nota de "muévenos a Principal". Merece la pena en los primeros
   * envíos, cuando Gmail todavía no sabe qué hacer con nosotros; después estorba.
   */
  avisoPromociones?: boolean;
};

/**
 * Nota para pedir que muevan el correo a la bandeja principal.
 *
 * Que alguien arrastre el correo a Principal, o responda, es la señal más fuerte
 * que se le puede dar a Gmail para que deje de clasificarnos como promoción. No
 * hay forma de forzarlo desde el envío: solo pedirlo.
 */
function notaPromociones(): string {
  return `
        <tr>
          <td style="padding:0 34px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="border-left:2px solid ${COLOR.acento};">
              <tr>
                <td style="padding:10px 0 10px 14px;font-family:${SANS};font-size:13px;line-height:1.65;color:${COLOR.suave};">
                  ¿Nos estás leyendo desde la pestaña <strong style="color:${COLOR.acento};font-weight:normal;">Promociones</strong>?
                  Arrastra este correo a <strong style="color:${COLOR.acento};font-weight:normal;">Principal</strong>
                  y los próximos te llegarán ahí.
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

export function renderBoletinHtml({
  nombre,
  asunto,
  cuerpo,
  unsubscribeUrl,
  avisoPromociones = false,
}: BoletinDatos): string {
  const sitio = getSiteUrl();

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapar(asunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.fondo};">

<!-- Resumen que algunos clientes muestran junto al asunto, sin ocupar espacio -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(asunto)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:${COLOR.fondo};padding:24px 12px;">
  <tr>
    <td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px;max-width:100%;background-color:${COLOR.panel};border:1px solid ${COLOR.borde};">

        <!-- Cabecera: el degradado del logo, como imagen para que funcione en todos
             los clientes. Un linear-gradient en CSS lo ignora Outlook. -->
        <tr>
          <td style="padding:0;">
            <img src="${sitio}/Assets/email/cabecera.jpg"
                 alt="Nemorphic"
                 width="600"
                 style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
          </td>
        </tr>

        <tr>
          <td style="padding:34px 34px 8px;">
            <p style="margin:0 0 6px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${COLOR.acento};">
              Más que groove, cultura
            </p>
            <h1 style="margin:0 0 22px;font-family:${SERIF};font-size:27px;line-height:1.25;font-weight:normal;color:${COLOR.acento};">
              ${escapar(asunto)}
            </h1>
            <p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.7;color:${COLOR.texto};">
              ${saludo(nombre)}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 34px 12px;">
            ${aParrafos(cuerpo)}
          </td>
        </tr>

${avisoPromociones ? notaPromociones() : ""}

        <!-- Un solo llamado a la acción, con la tabla haciendo de botón: un <a>
             con padding no se renderiza bien en Outlook. -->
        <tr>
          <td style="padding:14px 34px 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${COLOR.violeta};">
                  <a href="${sitio}"
                     style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:14px;letter-spacing:1px;color:${COLOR.texto};text-decoration:none;">
                    Ver la web
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pie: texto a la izquierda, la marca abajo a la derecha -->
        <tr>
          <td style="padding:22px 34px 26px;border-top:1px solid ${COLOR.borde};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" valign="middle"
                    style="font-family:${SANS};font-size:12px;line-height:1.7;color:${COLOR.suave};">
                  <strong style="color:${COLOR.acento};font-weight:normal;">Nemorphic</strong><br />
                  Recibes este correo porque te suscribiste en nuestra web.<br />
                  <a href="${unsubscribeUrl}" style="color:${COLOR.tenue};text-decoration:underline;">
                    Darme de baja
                  </a>
                </td>
                <td align="right" valign="bottom" width="60">
                  <img src="${sitio}/Assets/email/marca.jpg"
                       alt=""
                       width="46"
                       style="display:block;width:46px;height:auto;border:0;opacity:0.9;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Versión en texto plano. Obligatoria: un correo solo-HTML puntúa peor en los
 * filtros de spam y se ve roto donde no se carga el HTML.
 */
export function renderBoletinTexto({
  nombre,
  asunto,
  cuerpo,
  unsubscribeUrl,
  avisoPromociones = false,
}: BoletinDatos): string {
  const limpio = nombre?.trim();

  return [
    `NEMORPHIC — ${asunto}`,
    "",
    limpio ? `Hola, ${limpio}.` : "Hola.",
    "",
    cuerpo.trim(),
    "",
    ...(avisoPromociones
      ? [
          "¿Nos lees desde la pestaña Promociones? Arrastra este correo a",
          "Principal y los próximos te llegaran ahi.",
          "",
        ]
      : []),
    "—",
    `Ver la web: ${getSiteUrl()}`,
    "",
    "Recibes este correo porque te suscribiste en nuestra web.",
    `Darte de baja: ${unsubscribeUrl}`,
  ].join("\n");
}

/**
 * Token que llevan la vista previa y las pruebas a direcciones no suscritas.
 * La pagina /baja lo reconoce y explica que es un ejemplo, en vez de decir que
 * el enlace no es valido.
 */
export const TOKEN_DE_EJEMPLO = "00000000-0000-0000-0000-000000000000";

export function urlDeBaja(token: string): string {
  return `${getSiteUrl()}/baja?token=${token}`;
}
