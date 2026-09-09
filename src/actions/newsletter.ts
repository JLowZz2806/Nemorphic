import { createServerFn } from "@tanstack/react-start";

import { subscribeSchema } from "@/schemas/newsletter";

export type SubscribeResult = { ok: true } | { ok: false; message: string };

export const subscribe = createServerFn({ method: "POST" })
  .validator(subscribeSchema)
  .handler(async ({ data }): Promise<SubscribeResult> => {
    // Bot detectado por el campo trampa: se responde como si todo hubiera ido
    // bien, para no darle pistas de que fue descartado.
    if (data.website) return { ok: true };

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

    if (!isDatabaseConfigured()) {
      console.error("subscribe: faltan las variables de Supabase.");
      return { ok: false, message: "Las suscripciones no están disponibles ahora mismo." };
    }

    // `upsert` sobre el correo: suscribirse dos veces no falla ni duplica, y
    // reactiva a quien se había dado de baja y vuelve.
    const { error } = await getSupabaseAdmin().from("subscribers").upsert(
      {
        email: data.email,
        name: data.name,
        status: "active",
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error("subscribe:", error);
      return { ok: false, message: "No pudimos guardar tu correo. Intenta de nuevo." };
    }

    // Respuesta idéntica tanto si el correo era nuevo como si ya existía: así
    // nadie puede usar el formulario para averiguar quién está suscrito.
    return { ok: true };
  });
