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
   * Si llega con contenido, es un bot y la petición se descarta en silencio.
   */
  website: z.string().max(0).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;

/** Alta o edición de un suscriptor desde el panel. */
export const adminSubscriberSchema = z.object({
  name: nombreSuscriptor,
  email: correoSuscriptor,
  status: z.enum(["active", "unsubscribed"]),
});

export type AdminSubscriberInput = z.infer<typeof adminSubscriberSchema>;
