import { z } from "zod";

export const loginSchema = z.object({
  password: z
    .string()
    .min(1, "Escribe la clave")
    // Tope alto solo para que nadie mande un megabyte al servidor.
    .max(200, "La clave es demasiado larga"),
});

export type LoginInput = z.infer<typeof loginSchema>;
