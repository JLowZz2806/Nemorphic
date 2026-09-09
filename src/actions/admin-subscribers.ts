import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { adminSubscriberSchema } from "@/schemas/newsletter";
import { requireAdmin } from "@/lib/require-admin";

export type SuscriptorAdmin = {
  id: string;
  name: string | null;
  email: string;
  status: "active" | "unsubscribed";
  createdAt: string;
};

export const listSubscribers = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<SuscriptorAdmin>> => {
    await requireAdmin();

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
    if (!isDatabaseConfigured()) return [];

    const { data, error } = await getSupabaseAdmin()
      .from("subscribers")
      .select("id, name, email, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listSubscribers:", error);
      throw new Error("No se pudieron cargar los suscriptores");
    }

    return (data ?? []).map((fila) => ({
      id: fila.id,
      name: fila.name,
      email: fila.email,
      status: fila.status as SuscriptorAdmin["status"],
      createdAt: fila.created_at,
    }));
  },
);

export const createSubscriber = createServerFn({ method: "POST" })
  .validator(adminSubscriberSchema)
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { error } = await getSupabaseAdmin()
      .from("subscribers")
      .insert({ name: data.name, email: data.email, status: data.status });

    if (error) {
      // 23505 = correo ya registrado. Aquí sí se dice, porque quien lo ve es
      // del equipo: le ahorra buscar por qué "no se guardó".
      if (error.code === "23505") {
        return { ok: false as const, message: "Ese correo ya está en la lista." };
      }
      console.error("createSubscriber:", error);
      return { ok: false as const, message: "No se pudo añadir. Intenta de nuevo." };
    }

    return { ok: true as const };
  });

export const updateSubscriber = createServerFn({ method: "POST" })
  .validator(adminSubscriberSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { error } = await getSupabaseAdmin()
      .from("subscribers")
      .update({
        name: data.name,
        email: data.email,
        status: data.status,
        unsubscribed_at: data.status === "unsubscribed" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);

    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, message: "Ese correo ya está en la lista." };
      }
      console.error("updateSubscriber:", error);
      return { ok: false as const, message: "No se pudo guardar. Intenta de nuevo." };
    }

    return { ok: true as const };
  });

export const deleteSubscriber = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { error } = await getSupabaseAdmin().from("subscribers").delete().eq("id", data.id);

    if (error) {
      console.error("deleteSubscriber:", error);
      return { ok: false as const, message: "No se pudo eliminar. Intenta de nuevo." };
    }

    return { ok: true as const };
  });
