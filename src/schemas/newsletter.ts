import { z } from "zod";

export const nombreSuscriptor = z
  .string()
  .trim()
  .min(2, "Escribe tu nombre")
  .max(60, "El nombre es demasiado largo");

export const correoSuscriptor = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingresa un correo válido")
  .max(254, "El correo es demasiado largo");

/** Lo que envía el formulario público del boletín. */
export const subscribeSchema = z.object({
  name: nombreSuscriptor,
  email: correoSuscriptor,
  /**
   * Campo trampa: está oculto por CSS, así que una persona nunca lo rellena.
   * Si llega con contenido, es un bot y el servidor lo descarta en silencio.
   *
   * Acepta cualquier texto a propósito. Con `max(0)` la validación rechazaba la
   * petición antes de llegar al handler y devolvía un error, que es exactamente
   * la señal que no queremos darle a un bot: debe creer que funcionó.
   */
  website: z.string().max(500).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;

/** Alta o edición de un suscriptor desde el panel. */
export const adminSubscriberSchema = z.object({
  name: nombreSuscriptor,
  email: correoSuscriptor,
  status: z.enum(["active", "unsubscribed"]),
});

export type AdminSubscriberInput = z.infer<typeof adminSubscriberSchema>;

/** Lo que se redacta en el panel para enviar como boletín. */
export const boletinSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Escribe un asunto")
    // Los clientes de correo cortan los asuntos largos; 120 ya es generoso.
    .max(120, "El asunto es demasiado largo"),
  body: z
    .string()
    .trim()
    .min(20, "El mensaje es demasiado corto")
    .max(10000, "El mensaje es demasiado largo"),
  /** Solo para la previsualización y la prueba: no se guarda. */
  nombreEjemplo: z.string().trim().max(60).optional(),
});

export type BoletinInput = z.infer<typeof boletinSchema>;
