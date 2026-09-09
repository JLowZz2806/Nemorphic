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

/**
 * Campos de una reserva, sin las reglas cruzadas. Se mantiene como `ZodObject`
 * para poder derivar variantes con `.extend()`; las versiones que se usan de
 * verdad son las de abajo, que sí añaden la comprobación de acompañantes.
 */
const reservationBase = z.object({
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
});

/**
 * El número de acompañantes tiene que cuadrar con las entradas.
 *
 * El servidor no puede fiarse de que el formulario haya abierto los campos
 * correctos: cualquiera puede llamar a la server function directamente.
 */
function acompanantesCoherentes(
  valor: z.infer<typeof reservationBase>,
  ctx: z.RefinementCtx,
): void {
  const esperados = valor.tickets - 1;
  if (valor.guests.length === esperados) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["guests"],
    message:
      esperados === 0
        ? "Para una entrada no hacen falta acompañantes"
        : `Faltan los nombres de los acompañantes (${esperados})`,
  });
}

/** Reserva hecha desde el formulario público. */
export const reservationSchema = reservationBase.superRefine(acompanantesCoherentes);
export type ReservationInput = z.infer<typeof reservationSchema>;

/**
 * Alta de una reserva desde el panel, para cuando alguien la pide por WhatsApp o
 * en persona. Mismas reglas que la pública.
 */
export const adminReservationSchema = reservationSchema;
export type AdminReservationInput = z.infer<typeof adminReservationSchema>;

/** Edición de una reserva existente: lo mismo más el identificador. */
export const adminReservationUpdateSchema = reservationBase
  .extend({ id: z.string().uuid() })
  .superRefine(acompanantesCoherentes);
export type AdminReservationUpdateInput = z.infer<typeof adminReservationUpdateSchema>;

/**
 * Alfabeto del código de reserva: sin vocales (evita palabras involuntarias) y sin
 * caracteres que se confundan al dictarlos en voz alta (0/O, 1/I/L).
 */
const ALFABETO_CODIGO = "23456789BCDFGHJKMNPQRSTVWXYZ";

export const LARGO_CODIGO = 4;

/**
 * Código que la persona enseña en la puerta. Cuatro caracteres para que se pueda
 * leer y teclear rápido en la entrada.
 *
 * Con 28 caracteres posibles hay 614.656 combinaciones. La columna `code` tiene
 * restricción de unicidad y quien inserta reintenta si choca, así que un repetido
 * no rompe nada: solo cuesta otro intento.
 *
 * Vive en los schemas porque lo usan tanto la reserva pública como el alta desde
 * el panel, y así ambas generan códigos con el mismo formato.
 */
export function generarCodigoReserva(): string {
  let codigo = "";
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
  }
  return codigo;
}
