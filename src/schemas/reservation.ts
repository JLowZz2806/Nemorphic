import { z } from "zod";

export const MAX_TICKETS = 6;

/** Nombre de persona: se usa para el titular y para los acompañantes. */
const nombre = z
  .string()
  .trim()
  .min(3, "Escribe el nombre completo")
  .max(80, "El nombre es demasiado largo");

/**
 * Teléfono colombiano, tolerante con la forma de escribirlo: acepta espacios,
 * guiones, paréntesis y prefijo +57. Se valida sobre los dígitos que queden.
 */
const telefono = z
  .string()
  .trim()
  .min(7, "Escribe tu número de teléfono")
  .max(25, "El teléfono es demasiado largo")
  .refine((valor) => {
    const digitos = valor.replace(/\D/g, "");
    return digitos.length >= 7 && digitos.length <= 15;
  }, "Ese número no parece válido");

export const reservationSchema = z
  .object({
    eventSlug: z.string().min(1, "Elige un evento"),
    holderName: nombre,
    holderEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Ingresa un correo válido")
      .max(254, "El correo es demasiado largo"),
    holderPhone: telefono,
    tickets: z.coerce
      .number()
      .int("Elige un número entero de entradas")
      .min(1, "Reserva al menos una entrada")
      .max(MAX_TICKETS, `Máximo ${MAX_TICKETS} entradas por reserva`),
    /** Nombres de los acompañantes. El titular NO va aquí. */
    guests: z.array(z.object({ name: nombre })).max(MAX_TICKETS - 1),
  })
  .superRefine((valor, ctx) => {
    // El servidor no puede fiarse de que el formulario haya abierto los campos
    // correctos: cualquiera puede llamar a la server function directamente.
    const esperados = valor.tickets - 1;
    if (valor.guests.length !== esperados) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guests"],
        message:
          esperados === 0
            ? "Para una entrada no hacen falta acompañantes"
            : `Faltan los nombres de los acompañantes (${esperados})`,
      });
    }
  });

export type ReservationInput = z.infer<typeof reservationSchema>;
