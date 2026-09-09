import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";

export const getDoorAccessInfo = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const { doorPasswordIsSet } = await import("@/lib/auth");
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

  let actualizada: string | null = null;
  if (isDatabaseConfigured()) {
    const { data } = await getSupabaseAdmin()
      .from("app_settings")
      .select("updated_at")
      .eq("key", "door_password_hash")
      .maybeSingle();
    actualizada = data?.updated_at ?? null;
  }

  return { configurada: await doorPasswordIsSet(), actualizada };
});

/**
 * Cambia la clave de la puerta. Se guarda solo el hash.
 *
 * El mínimo es corto a propósito: la dicta alguien del equipo a la persona de la
 * entrada, y cambia en cada evento, así que una clave larga se copiaría mal.
 * Lo que protege de verdad es que caduca al cambiarla y que solo da permiso para
 * marcar ingreso y pago.
 */
export const setDoorAccessPassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      password: z.string().min(6, "Usa al menos 6 caracteres").max(100, "Demasiado larga"),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();

    const { setDoorPassword } = await import("@/lib/auth");

    try {
      await setDoorPassword(data.password);
    } catch (error) {
      console.error("setDoorAccessPassword:", error);
      return { ok: false as const, message: "No se pudo guardar la clave." };
    }

    return { ok: true as const };
  });

/** Cierra el acceso de puerta borrando la clave. */
export const clearDoorAccessPassword = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  const { getSupabaseAdmin } = await import("@/lib/supabase");

  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .delete()
    .eq("key", "door_password_hash");

  if (error) {
    console.error("clearDoorAccessPassword:", error);
    return { ok: false as const, message: "No se pudo cerrar el acceso." };
  }

  return { ok: true as const };
});

/** Precios del evento, en pesos y sin decimales. */
export const setEventPrices = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1),
      presalePrice: z.coerce.number().int().min(0).max(10_000_000),
      doorPrice: z.coerce.number().int().min(0).max(10_000_000),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { error } = await getSupabaseAdmin()
      .from("events")
      .update({ presale_price: data.presalePrice, door_price: data.doorPrice })
      .eq("slug", data.slug);

    if (error) {
      console.error("setEventPrices:", error);
      return { ok: false as const, message: "No se pudieron guardar los precios." };
    }

    return { ok: true as const };
  });
