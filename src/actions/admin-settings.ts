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
/** Un evento visto desde el panel, solo con lo que hace falta para elegir cuál destacar. */
export type EventoResumen = {
  slug: string;
  name: string;
  startsAt: string;
  featured: boolean;
};

/**
 * Los eventos que la web puede llegar a mostrar: futuros y con reservas abiertas,
 * que es exactamente lo que filtra la parte pública.
 *
 * Se queda corto a propósito — no trae reservas ni dinero. Para eso está
 * `/admin/reservas`; esto solo alimenta el selector del destacado.
 */
export const listEventsSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<EventoResumen>> => {
    await requireAdmin();

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
    if (!isDatabaseConfigured()) return [];

    const { data, error } = await getSupabaseAdmin()
      .from("events")
      .select("slug, name, starts_at, featured")
      .eq("reservations_open", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("listEventsSummary:", error);
      return [];
    }

    return (data ?? []).map((fila) => ({
      slug: fila.slug,
      name: fila.name,
      startsAt: fila.starts_at,
      featured: fila.featured ?? false,
    }));
  },
);

/**
 * Marca qué evento sale en la landing.
 *
 * Se apaga el anterior antes de encender el nuevo porque la base solo admite uno
 * destacado (índice parcial de la migración 0005): hacerlo al revés choca contra
 * esa restricción.
 *
 * No son dos escrituras atómicas. Si fallara la segunda, la web se quedaría sin
 * destacado y mostraría el evento más próximo, que es justo el comportamiento de
 * reserva previsto en la landing: se degrada a algo razonable, no a un hueco.
 */
export const setFeaturedEvent = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();

    const { error: apagarError } = await supabase
      .from("events")
      .update({ featured: false })
      .eq("featured", true);

    if (apagarError) {
      console.error("setFeaturedEvent (apagar):", apagarError);
      return { ok: false as const, message: "No se pudo cambiar el evento destacado." };
    }

    const { error } = await supabase
      .from("events")
      .update({ featured: true })
      .eq("slug", data.slug);

    if (error) {
      console.error("setFeaturedEvent (encender):", error);
      return { ok: false as const, message: "No se pudo cambiar el evento destacado." };
    }

    return { ok: true as const };
  });

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
