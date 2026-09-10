import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type BajaResult =
  { ok: true; email: string } | { ok: false; motivo: "token-invalido" | "error" };

/**
 * Da de baja del boletín con un token, sin necesidad de iniciar sesión.
 *
 * Es una obligación legal: todo correo debe llevar un enlace de baja que funcione
 * de un clic. El token es un uuid propio de cada suscriptor, así que nadie puede
 * dar de baja a otra persona sin haber recibido su correo.
 *
 * No borra la fila: la marca como `unsubscribed`. Así, si la persona vuelve a
 * suscribirse, se reactiva en vez de duplicarse.
 */
export const unsubscribe = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().uuid("Enlace inválido") }))
  .handler(async ({ data }): Promise<BajaResult> => {
    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

    if (!isDatabaseConfigured()) {
      console.error("unsubscribe: faltan las variables de Supabase.");
      return { ok: false, motivo: "error" };
    }

    const supabase = getSupabaseAdmin();

    const { data: suscriptor, error: lecturaError } = await supabase
      .from("subscribers")
      .select("id, email")
      .eq("unsubscribe_token", data.token)
      .maybeSingle();

    if (lecturaError) {
      console.error("unsubscribe (lectura):", lecturaError);
      return { ok: false, motivo: "error" };
    }
    if (!suscriptor) {
      return { ok: false, motivo: "token-invalido" };
    }

    const { error } = await supabase
      .from("subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("id", suscriptor.id);

    if (error) {
      console.error("unsubscribe (actualizacion):", error);
      return { ok: false, motivo: "error" };
    }

    return { ok: true, email: suscriptor.email };
  });
