import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import { boletinSchema } from "@/schemas/newsletter";

/**
 * Cuántos correos se mandan por petición.
 *
 * Vercel corta las funciones a los pocos segundos y cada correo por SMTP tarda
 * uno o dos. Cinco deja margen de sobra; el panel llama en bucle hasta terminar,
 * así que el tamaño del lote solo cambia cuántas vueltas da, no el resultado.
 */
const TAMANO_LOTE = 5;

export type CampanaResumen = {
  id: string;
  subject: string;
  body: string;
  status: "draft" | "sending" | "sent";
  createdAt: string;
  sentAt: string | null;
  enviados: number;
  fallidos: number;
};

export type ProgresoEnvio = {
  enviados: number;
  fallidos: number;
  restantes: number;
  /** Correos que fallaron en este lote, para poder avisar de qué pasó. */
  errores: Array<{ email: string; motivo: string }>;
};

/** Estado de la configuración de correo, para avisar antes de que alguien redacte. */
export const getEstadoCorreo = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const { isEmailConfigured } = await import("@/lib/email/provider");
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

  if (!isEmailConfigured()) {
    return { configurado: false as const, suscritos: 0 };
  }

  let suscritos = 0;
  if (isDatabaseConfigured()) {
    const { count } = await getSupabaseAdmin()
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    suscritos = count ?? 0;
  }

  return { configurado: true as const, suscritos };
});

/** Comprueba las credenciales contra Gmail sin enviar nada. */
export const probarConexionCorreo = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  const { verificarConexion } = await import("@/lib/email/provider");
  const resultado = await verificarConexion();

  if (!resultado.ok) {
    console.error("probarConexionCorreo:", resultado.error);
    return {
      ok: false as const,
      message:
        "No se pudo conectar con Gmail. Revisa EMAIL_FROM y EMAIL_APP_PASSWORD, " +
        "y que la verificación en dos pasos siga activa.",
    };
  }

  return { ok: true as const };
});

/** Devuelve el HTML real del boletín, para previsualizarlo tal como llegará. */
export const previsualizarBoletin = createServerFn({ method: "POST" })
  .validator(boletinSchema)
  .handler(async ({ data }) => {
    await requireAdmin();

    const { renderBoletinHtml, urlDeBaja } = await import("@/lib/email/templates");

    return {
      html: renderBoletinHtml({
        nombre: data.nombreEjemplo?.trim() || "Nombre de la persona",
        asunto: data.subject,
        cuerpo: data.body,
        unsubscribeUrl: urlDeBaja("00000000-0000-0000-0000-000000000000"),
      }),
    };
  });

/** Envía una sola copia a la dirección que indique el equipo, sin tocar la lista. */
export const enviarPrueba = createServerFn({ method: "POST" })
  .validator(boletinSchema.extend({ to: z.string().trim().toLowerCase().email("Correo inválido") }))
  .handler(async ({ data }) => {
    await requireAdmin();

    const { enviarCorreo } = await import("@/lib/email/provider");
    const { renderBoletinHtml, renderBoletinTexto, urlDeBaja } =
      await import("@/lib/email/templates");

    const datos = {
      nombre: data.nombreEjemplo?.trim() || "Nombre de la persona",
      asunto: data.subject,
      cuerpo: data.body,
      unsubscribeUrl: urlDeBaja("00000000-0000-0000-0000-000000000000"),
    };

    try {
      await enviarCorreo({
        to: data.to,
        subject: `[PRUEBA] ${data.subject}`,
        html: renderBoletinHtml(datos),
        text: renderBoletinTexto(datos),
      });
    } catch (error) {
      console.error("enviarPrueba:", error);
      return { ok: false as const, message: "No se pudo enviar la prueba. Revisa la conexión." };
    }

    return { ok: true as const };
  });

/**
 * Guarda el boletín y lo deja listo para enviar.
 *
 * Se guarda antes de mandar nada para que el envío pueda ir por lotes: si la
 * conexión se corta a la mitad, se reanuda desde aquí sin repetir a nadie.
 */
export const crearCampana = createServerFn({ method: "POST" })
  .validator(boletinSchema)
  .handler(async ({ data }) => {
    await requireAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { data: campana, error } = await getSupabaseAdmin()
      .from("campaigns")
      .insert({ subject: data.subject, body: data.body, status: "sending" })
      .select("id")
      .single();

    if (error) {
      console.error("crearCampana:", error);
      return { ok: false as const, message: "No se pudo preparar el envío." };
    }

    return { ok: true as const, id: campana.id };
  });

/**
 * Envía el siguiente lote de una campaña.
 *
 * Cada correo se arma con el nombre y el token de baja de quien lo recibe, y se
 * manda por separado. Nunca en copia oculta: eso filtraría la lista completa a
 * cada destinatario, y además impide personalizar el saludo.
 */
export const enviarLoteCampana = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(
    async ({ data }): Promise<{ ok: false; message: string } | ({ ok: true } & ProgresoEnvio)> => {
      await requireAdmin();

      const { getSupabaseAdmin } = await import("@/lib/supabase");
      const { enviarLote } = await import("@/lib/email/provider");
      const { renderBoletinHtml, renderBoletinTexto, urlDeBaja } =
        await import("@/lib/email/templates");

      const supabase = getSupabaseAdmin();

      const { data: campana, error: campanaError } = await supabase
        .from("campaigns")
        .select("id, subject, body, status")
        .eq("id", data.id)
        .maybeSingle();

      if (campanaError || !campana) {
        return { ok: false, message: "Ese boletín ya no existe." };
      }

      const { data: suscriptores, error: suscriptoresError } = await supabase
        .from("subscribers")
        .select("id, name, email, unsubscribe_token")
        .eq("status", "active");

      if (suscriptoresError) {
        console.error("enviarLoteCampana (suscriptores):", suscriptoresError);
        return { ok: false, message: "No se pudo leer la lista de suscriptores." };
      }

      const { data: yaEnviados, error: enviadosError } = await supabase
        .from("campaign_sends")
        .select("subscriber_id, error")
        .eq("campaign_id", campana.id);

      if (enviadosError) {
        console.error("enviarLoteCampana (enviados):", enviadosError);
        return { ok: false, message: "No se pudo comprobar a quién ya se le envió." };
      }

      const tratados = new Set((yaEnviados ?? []).map((f) => f.subscriber_id));
      const pendientes = (suscriptores ?? []).filter((s) => !tratados.has(s.id));
      const lote = pendientes.slice(0, TAMANO_LOTE);

      const erroresDelLote: Array<{ email: string; motivo: string }> = [];

      if (lote.length > 0) {
        // Cada mensaje se arma con el nombre y el token de baja de SU destinatario.
        // Por eso va un correo por persona: en copia oculta no se podria
        // personalizar, y ademas filtraria la lista completa a cada uno.
        const resultados = await enviarLote(
          lote.map((s) => {
            const datos = {
              nombre: s.name,
              asunto: campana.subject,
              cuerpo: campana.body,
              unsubscribeUrl: urlDeBaja(s.unsubscribe_token),
            };
            return {
              to: s.email,
              subject: campana.subject,
              html: renderBoletinHtml(datos),
              text: renderBoletinTexto(datos),
              unsubscribeUrl: datos.unsubscribeUrl,
            };
          }),
        );

        const filas = lote.map((s, i) => ({
          campaign_id: campana.id,
          subscriber_id: s.id,
          error: resultados[i]?.error ?? null,
        }));

        for (const [i, s] of lote.entries()) {
          const motivo = resultados[i]?.error;
          if (motivo) erroresDelLote.push({ email: s.email, motivo });
        }

        const { error: registroError } = await supabase.from("campaign_sends").insert(filas);

        if (registroError) {
          // Si esto falla, el correo ya salio pero no queda registrado. Se avisa
          // fuerte: reintentar volveria a enviar a esas mismas personas.
          console.error("enviarLoteCampana (registro):", registroError);
          return {
            ok: false,
            message:
              "Los correos salieron pero no se pudieron registrar. NO vuelvas a enviar: " +
              "avisa al desarrollador para revisarlo.",
          };
        }
      }

      const { data: total } = await supabase
        .from("campaign_sends")
        .select("error")
        .eq("campaign_id", campana.id);

      const enviados = (total ?? []).filter((f) => !f.error).length;
      const fallidos = (total ?? []).filter((f) => f.error).length;
      const restantes = Math.max(0, pendientes.length - lote.length);

      if (restantes === 0 && campana.status !== "sent") {
        await supabase
          .from("campaigns")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", campana.id);
      }

      return { ok: true, enviados, fallidos, restantes, errores: erroresDelLote };
    },
  );

export const listarCampanas = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<CampanaResumen>> => {
    await requireAdmin();

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
    if (!isDatabaseConfigured()) return [];

    const supabase = getSupabaseAdmin();

    const { data: campanas, error } = await supabase
      .from("campaigns")
      .select("id, subject, body, status, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("listarCampanas:", error);
      throw new Error("No se pudieron cargar los boletines");
    }

    const { data: envios } = await supabase.from("campaign_sends").select("campaign_id, error");

    return (campanas ?? []).map((c) => {
      const propios = (envios ?? []).filter((e) => e.campaign_id === c.id);
      return {
        id: c.id,
        subject: c.subject,
        body: c.body,
        status: c.status as CampanaResumen["status"],
        createdAt: c.created_at,
        sentAt: c.sent_at,
        enviados: propios.filter((e) => !e.error).length,
        fallidos: propios.filter((e) => e.error).length,
      };
    });
  },
);
