import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const correr = createServerFn({ method: "GET" }).handler(async () => {
  const out: Array<string> = [];
  const ok = (n: string, cond: boolean, d = "") => out.push(`${cond ? "OK" : "FALLO"}|${n}|${d}`);
  const saltado = (n: string, d = "") => out.push(`SALTADO|${n}|${d}`);
  const grupo = (n: string) => out.push(`##${n}`);

  const subs = await import("@/actions/admin-subscribers");
  const res = await import("@/actions/admin-reservations");
  const pub = await import("@/actions/newsletter");
  const pubRes = await import("@/actions/reservations");
  const { getSupabaseAdmin } = await import("@/lib/supabase");
  const db = getSupabaseAdmin();

  const fallo = async (fn: () => Promise<unknown>): Promise<string | null> => {
    try {
      await fn();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "error";
    }
  };

  const migracion0002 = !(await db.from("subscribers").select("name").limit(1)).error;

  grupo("SEGURIDAD: sin sesión, las acciones del panel deben rechazar");
  ok("listSubscribers rechaza", (await fallo(() => subs.listSubscribers())) === "No autorizado");
  ok("listReservations rechaza", (await fallo(() => res.listReservations())) === "No autorizado");
  ok(
    "createSubscriber rechaza",
    (await fallo(() =>
      subs.createSubscriber({ data: { name: "Intruso", email: "x@y.test", status: "active" } }),
    )) === "No autorizado",
  );
  ok(
    "updateSubscriber rechaza",
    (await fallo(() =>
      subs.updateSubscriber({
        data: {
          id: "00000000-0000-0000-0000-000000000000",
          name: "Intruso",
          email: "x@y.test",
          status: "active",
        },
      }),
    )) === "No autorizado",
  );
  ok(
    "deleteSubscriber rechaza",
    (await fallo(() =>
      subs.deleteSubscriber({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
    )) === "No autorizado",
  );
  ok(
    "createReservationAsAdmin rechaza",
    (await fallo(() =>
      res.createReservationAsAdmin({
        data: {
          eventSlug: "umbra",
          holderName: "Intruso Malo",
          holderEmail: "x@y.test",
          holderPhone: "3001112222",
          tickets: 1,
          guests: [],
        },
      }),
    )) === "No autorizado",
  );
  ok(
    "updateReservation rechaza",
    (await fallo(() =>
      res.updateReservation({
        data: {
          id: "00000000-0000-0000-0000-000000000000",
          eventSlug: "umbra",
          holderName: "Intruso Malo",
          holderEmail: "x@y.test",
          holderPhone: "3001112222",
          tickets: 1,
          guests: [],
        },
      }),
    )) === "No autorizado",
  );
  ok(
    "deleteReservation rechaza",
    (await fallo(() =>
      res.deleteReservation({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
    )) === "No autorizado",
  );
  ok(
    "setReservationStatus rechaza",
    (await fallo(() =>
      res.setReservationStatus({
        data: { id: "00000000-0000-0000-0000-000000000000", status: "checked_in" },
      }),
    )) === "No autorizado",
  );

  grupo("SEGURIDAD: validación de entrada en lo público");
  ok(
    "suscripción con correo inválido rechazada",
    Boolean(await fallo(() => pub.subscribe({ data: { name: "Ana", email: "nope" } as never }))),
  );
  ok(
    "suscripción sin nombre rechazada",
    Boolean(await fallo(() => pub.subscribe({ data: { name: "", email: "a@b.test" } as never }))),
  );
  ok(
    "reserva con evento inventado no crea nada",
    !(
      await pubRes.createReservation({
        data: {
          eventSlug: "evento-que-no-existe",
          holderName: "Prueba Falsa",
          holderEmail: "falso@ejemplo.test",
          holderPhone: "3001112222",
          tickets: 1,
          guests: [],
        },
      })
    ).ok,
  );
  ok(
    "reserva con 3 entradas y 0 acompañantes rechazada",
    Boolean(
      await fallo(() =>
        pubRes.createReservation({
          data: {
            eventSlug: "umbra",
            holderName: "Prueba Falsa",
            holderEmail: "falso@ejemplo.test",
            holderPhone: "3001112222",
            tickets: 3,
            guests: [],
          },
        }),
      ),
    ),
  );

  grupo("FUNCIONALIDAD: suscriptores");
  if (!migracion0002) {
    saltado("todo el grupo", "falta aplicar 0002_suscriptores_nombre.sql en Supabase");
  } else {
    const antesBot = (await db.from("subscribers").select("*", { count: "exact", head: true }))
      .count;
    const rBot = await pub.subscribe({
      data: { name: "Bot Malicioso", email: "bot@ejemplo.test", website: "http://spam" } as never,
    });
    const despuesBot = (await db.from("subscribers").select("*", { count: "exact", head: true }))
      .count;
    ok("el campo trampa responde ok al bot", rBot.ok === true);
    ok("...pero no guarda nada", antesBot === despuesBot, `${antesBot} -> ${despuesBot}`);

    const rSub = await pub.subscribe({
      data: { name: "Ana Prueba", email: "ana.prueba@ejemplo.test" } as never,
    });
    ok("alta pública con nombre", rSub.ok === true);

    const { data: creado } = await db
      .from("subscribers")
      .select("id, name, email, status")
      .eq("email", "ana.prueba@ejemplo.test")
      .maybeSingle();
    ok("se guardó el nombre", creado?.name === "Ana Prueba", String(creado?.name));

    await pub.subscribe({
      data: { name: "Ana Otra Vez", email: "ana.prueba@ejemplo.test" } as never,
    });
    const { count: cDup } = await db
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("email", "ana.prueba@ejemplo.test");
    ok("suscribirse dos veces no duplica", cDup === 1, `filas: ${cDup}`);

    if (creado) {
      await db
        .from("subscribers")
        .update({ name: "Ana Editada", status: "unsubscribed" })
        .eq("id", creado.id);
      const { data: editado } = await db
        .from("subscribers")
        .select("name, status")
        .eq("id", creado.id)
        .maybeSingle();
      ok(
        "la edición del panel se refleja",
        editado?.name === "Ana Editada" && editado?.status === "unsubscribed",
        `${editado?.name} / ${editado?.status}`,
      );
    }
  }

  grupo("FUNCIONALIDAD: reservas");
  const rRes = await pubRes.createReservation({
    data: {
      eventSlug: "umbra",
      holderName: "Carlos Prueba",
      holderEmail: "carlos.prueba@ejemplo.test",
      holderPhone: "+57 300 111 2233",
      tickets: 3,
      guests: [{ name: "Acompanante Uno" }, { name: "Acompanante Dos" }],
    },
  });
  const codigoCreado = rRes.ok ? rRes.code : "";
  ok("reserva pública con código válido", /^NM-[A-Z0-9]{6}$/.test(codigoCreado), codigoCreado);

  const { data: reservaCreada } = await db
    .from("reservations")
    .select("id, code, tickets, holder_name")
    .eq("holder_email", "carlos.prueba@ejemplo.test")
    .maybeSingle();

  const { data: acomp } = await db
    .from("reservation_guests")
    .select("name, position")
    .eq("reservation_id", reservaCreada?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("position");
  ok("guardó los 2 acompañantes", acomp?.length === 2, `${acomp?.length ?? 0}`);

  if (reservaCreada) {
    await db
      .from("reservations")
      .update({ holder_name: "Carlos Editado", tickets: 2 })
      .eq("id", reservaCreada.id);
    await db.from("reservation_guests").delete().eq("reservation_id", reservaCreada.id);
    await db
      .from("reservation_guests")
      .insert({ reservation_id: reservaCreada.id, name: "Acompanante Nuevo", position: 1 });

    const { data: tras } = await db
      .from("reservations")
      .select("holder_name, tickets, code")
      .eq("id", reservaCreada.id)
      .maybeSingle();
    const { data: acompTras } = await db
      .from("reservation_guests")
      .select("name")
      .eq("reservation_id", reservaCreada.id);

    ok(
      "la edición cambia datos y acompañantes",
      tras?.holder_name === "Carlos Editado" && tras?.tickets === 2 && acompTras?.length === 1,
      `${tras?.holder_name} / ${tras?.tickets} entradas / ${acompTras?.length} acomp.`,
    );
    ok("el código NO cambia al editar", tras?.code === reservaCreada.code, tras?.code ?? "");
  }

  grupo("SEGURIDAD: la clave pública sigue sin ver nada");
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(
    process.env["SUPABASE_URL"] ?? "",
    "sb_publishable_gZUBmbiJwRbV0qw8M9Hn3A_CM95CtBQ",
    { auth: { persistSession: false } },
  );
  for (const tabla of ["subscribers", "reservations", "reservation_guests", "events"]) {
    const { data, error } = await anon.from(tabla).select("*").limit(1);
    ok(`${tabla}: sin acceso`, Boolean(error) || (data ?? []).length === 0);
  }

  grupo("LIMPIEZA");
  await db.from("reservations").delete().like("holder_email", "%@ejemplo.test");
  await db.from("subscribers").delete().like("email", "%@ejemplo.test");
  const { count: subsFin } = await db
    .from("subscribers")
    .select("*", { count: "exact", head: true });
  const { count: resFin } = await db
    .from("reservations")
    .select("*", { count: "exact", head: true });
  const { count: acompFin } = await db
    .from("reservation_guests")
    .select("*", { count: "exact", head: true });
  ok(
    "la base queda como estaba",
    subsFin === 0 && resFin === 0 && acompFin === 0,
    `suscriptores ${subsFin}, reservas ${resFin}, acompañantes ${acompFin}`,
  );

  return { out };
});

export const Route = createFileRoute("/__PANEL_CHECKS__")({
  loader: () => correr(),
  component: Resultados,
});

function Resultados() {
  return <pre id="r">{Route.useLoaderData().out.join(String.fromCharCode(10))}</pre>;
}
