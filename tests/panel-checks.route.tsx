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
  const puerta = await import("@/actions/door");
  const ajustes = await import("@/actions/admin-settings");
  const boletin = await import("@/actions/newsletter-admin");
  const baja = await import("@/actions/unsubscribe");
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
  const migracion0004 =
    !(await db.from("campaigns").select("id").limit(1)).error &&
    !(await db.from("campaign_sends").select("id").limit(1)).error;
  const migracion0003 =
    !(await db.from("reservations").select("paid").limit(1)).error &&
    !(await db.from("app_settings").select("key").limit(1)).error;

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
  ok("reserva pública con código válido", /^[A-Z0-9]{4}$/.test(codigoCreado), codigoCreado);

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

  grupo("SEGURIDAD: el rol de puerta no puede hacer cosas de admin");
  // Sin ninguna sesion, todo debe rechazar. Lo que importa es que las acciones de
  // puerta usan requireDoorOrAdmin y las de admin requireAdmin: una sesion de
  // puerta jamas pasa por requireAdmin, porque isAdmin() mira otra cookie.
  ok(
    "listReservationsForDoor rechaza sin sesion",
    (await fallo(() => puerta.listReservationsForDoor())) === "No autorizado",
  );
  ok(
    "setCheckIn rechaza sin sesion",
    (await fallo(() =>
      puerta.setCheckIn({
        data: { id: "00000000-0000-0000-0000-000000000000", entered: true },
      }),
    )) === "No autorizado",
  );
  ok(
    "setPaid rechaza sin sesion",
    (await fallo(() =>
      puerta.setPaid({ data: { id: "00000000-0000-0000-0000-000000000000", paid: true } }),
    )) === "No autorizado",
  );
  ok(
    "setDoorAccessPassword rechaza sin sesion",
    (await fallo(() => ajustes.setDoorAccessPassword({ data: { password: "colarme123" } }))) ===
      "No autorizado",
  );
  ok(
    "setEventPrices rechaza sin sesion",
    (await fallo(() =>
      ajustes.setEventPrices({ data: { slug: "umbra", presalePrice: 1, doorPrice: 1 } }),
    )) === "No autorizado",
  );
  ok(
    "getDoorAccessInfo rechaza sin sesion",
    (await fallo(() => ajustes.getDoorAccessInfo())) === "No autorizado",
  );

  grupo("SEGURIDAD/FUNCIONALIDAD: clave de puerta");
  if (!migracion0003) {
    saltado("todo el grupo", "falta aplicar 0003_pagos_y_puerta.sql en Supabase");
  } else {
    const auth = await import("@/lib/auth");

    // Se guarda la clave real para devolverla al final: si no, correr las
    // pruebas dejaria al equipo sin acceso de puerta sin que nadie lo note.
    //
    // Si lo que hay guardado es la clave de prueba, es basura de una ejecucion
    // que se corto a medias: no se restaura, se deja limpio.
    const { data: guardada } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "door_password_hash")
      .maybeSingle();

    const esBasuraDePruebas =
      typeof guardada?.value === "string" &&
      auth.verifyPassword("clave-de-prueba-puerta", guardada.value);
    const claveOriginal = esBasuraDePruebas ? null : guardada;

    await auth.setDoorPassword("clave-de-prueba-puerta");
    ok("la clave se guarda", await auth.doorPasswordIsSet());

    const { data: fila } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "door_password_hash")
      .maybeSingle();
    ok(
      "se guarda el hash, nunca la clave en claro",
      Boolean(fila?.value) && !String(fila?.value).includes("clave-de-prueba-puerta"),
    );

    ok("la clave correcta valida", await auth.verifyDoorPassword("clave-de-prueba-puerta"));
    ok("una clave incorrecta no valida", !(await auth.verifyDoorPassword("otra-cosa")));

    // La huella es lo que invalida las sesiones abiertas: si cambia la clave,
    // cambia la huella, y las cookies emitidas con la anterior dejan de valer.
    const huellaA = await auth.huellaClavePuertaParaPruebas();
    await auth.setDoorPassword("otra-clave-distinta");
    const huellaB = await auth.huellaClavePuertaParaPruebas();
    ok(
      "cambiar la clave cambia la huella de sesion",
      Boolean(huellaA) && Boolean(huellaB) && huellaA !== huellaB,
    );

    await db.from("app_settings").delete().eq("key", "door_password_hash");
    ok("sin clave configurada, el acceso queda cerrado", !(await auth.doorPasswordIsSet()));
    ok("y nada valida", !(await auth.verifyDoorPassword("clave-de-prueba-puerta")));
    ok(
      "sin clave no hay huella, asi que ninguna sesion vale",
      (await auth.huellaClavePuertaParaPruebas()) === null,
    );

    // Se devuelve la clave que hubiera antes de las pruebas.
    if (claveOriginal?.value) {
      await db
        .from("app_settings")
        .upsert({ key: "door_password_hash", value: claveOriginal.value }, { onConflict: "key" });
    }
  }

  grupo("FUNCIONALIDAD: pagos");
  if (!migracion0003) {
    saltado("todo el grupo", "falta aplicar 0003_pagos_y_puerta.sql en Supabase");
  } else {
    await db.from("events").update({ presale_price: 15000, door_price: 20000 }).eq("slug", "umbra");

    const rPago = await pubRes.createReservation({
      data: {
        eventSlug: "umbra",
        holderName: "Pago Prueba",
        holderEmail: "pago.prueba@ejemplo.test",
        holderPhone: "3009998888",
        tickets: 2,
        guests: [{ name: "Acompanante Pago" }],
      },
    });
    ok("reserva creada para probar el pago", rPago.ok === true);

    const { data: nueva } = await db
      .from("reservations")
      .select("id, paid, tickets")
      .eq("holder_email", "pago.prueba@ejemplo.test")
      .maybeSingle();
    ok("nace sin pagar", nueva?.paid === false, String(nueva?.paid));

    const { data: ev } = await db
      .from("events")
      .select("presale_price")
      .eq("slug", "umbra")
      .maybeSingle();
    const esperado = (ev?.presale_price ?? 0) * (nueva?.tickets ?? 0);
    ok("el total a pagar es entradas x precio de preventa", esperado === 30000, String(esperado));

    if (nueva) {
      await db
        .from("reservations")
        .update({ paid: true, paid_at: new Date().toISOString(), paid_by: "door" })
        .eq("id", nueva.id);
      const { data: tras } = await db
        .from("reservations")
        .select("paid, paid_by, paid_at")
        .eq("id", nueva.id)
        .maybeSingle();
      ok(
        "queda registrado que se cobro en la puerta",
        tras?.paid === true && tras?.paid_by === "door" && Boolean(tras?.paid_at),
        String(tras?.paid_by),
      );

      const { error: errOrigen } = await db
        .from("reservations")
        .update({ paid_by: "inventado" })
        .eq("id", nueva.id);
      ok("la base rechaza un origen de pago invalido", Boolean(errOrigen));
    }
  }

  grupo("SEGURIDAD: las acciones del boletin exigen sesion de admin");
  ok("getEstadoCorreo rechaza", (await fallo(() => boletin.getEstadoCorreo())) === "No autorizado");
  ok("listarCampanas rechaza", (await fallo(() => boletin.listarCampanas())) === "No autorizado");
  ok(
    "previsualizarBoletin rechaza",
    (await fallo(() =>
      boletin.previsualizarBoletin({
        data: { subject: "Colarme", body: "x".repeat(30) },
      }),
    )) === "No autorizado",
  );
  ok(
    "enviarPrueba rechaza",
    (await fallo(() =>
      boletin.enviarPrueba({
        data: { subject: "Colarme", body: "x".repeat(30), to: "intruso@ejemplo.test" },
      }),
    )) === "No autorizado",
  );
  ok(
    "crearCampana rechaza",
    (await fallo(() =>
      boletin.crearCampana({ data: { subject: "Colarme", body: "x".repeat(30) } }),
    )) === "No autorizado",
  );
  ok(
    "enviarLoteCampana rechaza",
    (await fallo(() =>
      boletin.enviarLoteCampana({ data: { id: "00000000-0000-0000-0000-000000000000" } }),
    )) === "No autorizado",
  );
  ok(
    "probarConexionCorreo rechaza",
    (await fallo(() => boletin.probarConexionCorreo())) === "No autorizado",
  );

  grupo("FUNCIONALIDAD: baja del boletin");
  {
    await db.from("subscribers").delete().eq("email", "baja.auto@ejemplo.test");
    const { data: nuevo } = await db
      .from("subscribers")
      .insert({ name: "Baja Auto", email: "baja.auto@ejemplo.test", status: "active" })
      .select("unsubscribe_token")
      .single();

    const conTokenMalo = await baja.unsubscribe({
      data: { token: "00000000-0000-0000-0000-000000000000" },
    });
    ok("un token que no existe se rechaza", !conTokenMalo.ok);

    const r = await baja.unsubscribe({ data: { token: nuevo.unsubscribe_token } });
    ok("el token correcto da de baja", r.ok === true);

    const { data: tras } = await db
      .from("subscribers")
      .select("status, unsubscribed_at")
      .eq("email", "baja.auto@ejemplo.test")
      .maybeSingle();
    ok(
      "queda unsubscribed, no borrado",
      tras?.status === "unsubscribed" && Boolean(tras?.unsubscribed_at),
      String(tras?.status),
    );

    const { data: activos } = await db
      .from("subscribers")
      .select("email")
      .eq("status", "active")
      .eq("email", "baja.auto@ejemplo.test");
    ok("ya no sale en la lista de envio", (activos ?? []).length === 0);
  }

  grupo("FUNCIONALIDAD: registro de envios");
  if (!migracion0004) {
    saltado("todo el grupo", "falta aplicar 0004_boletin.sql en Supabase");
  } else {
    const { data: campana } = await db
      .from("campaigns")
      .insert({ subject: "Prueba automatica", body: "Cuerpo de prueba", status: "sending" })
      .select("id")
      .single();

    const { data: sus } = await db
      .from("subscribers")
      .insert({ name: "Envio Auto", email: "envio.auto@ejemplo.test", status: "active" })
      .select("id")
      .single();

    if (campana && sus) {
      const { error: e1 } = await db
        .from("campaign_sends")
        .insert({ campaign_id: campana.id, subscriber_id: sus.id });
      ok("se registra un envio", !e1, e1?.message ?? "");

      const { error: e2 } = await db
        .from("campaign_sends")
        .insert({ campaign_id: campana.id, subscriber_id: sus.id });
      ok(
        "no se puede registrar dos veces a la misma persona",
        e2?.code === "23505",
        e2?.code ?? "LO ACEPTO",
      );

      const { error: e3 } = await db
        .from("campaigns")
        .update({ status: "inventado" })
        .eq("id", campana.id);
      ok("la base rechaza un estado de campana invalido", Boolean(e3));

      await db.from("campaigns").delete().eq("id", campana.id);
      const { count } = await db
        .from("campaign_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campana.id);
      ok("al borrar la campana se borran sus envios", count === 0, `quedan ${count}`);
    }
  }

  grupo("SEGURIDAD: la clave pública sigue sin ver nada");
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(
    process.env["SUPABASE_URL"] ?? "",
    "sb_publishable_gZUBmbiJwRbV0qw8M9Hn3A_CM95CtBQ",
    { auth: { persistSession: false } },
  );
  const tablas = ["subscribers", "reservations", "reservation_guests", "events"];
  if (migracion0003) tablas.push("app_settings");
  if (migracion0004) tablas.push("campaigns", "campaign_sends");
  for (const tabla of tablas) {
    const { data, error } = await anon.from(tabla).select("*").limit(1);
    ok(`${tabla}: sin acceso`, Boolean(error) || (data ?? []).length === 0);
  }

  grupo("LIMPIEZA");
  await db.from("reservations").delete().like("holder_email", "%@ejemplo.test");
  await db.from("campaigns").delete().eq("subject", "Prueba automatica");
  await db.from("subscribers").delete().like("email", "%@ejemplo.test");
  // Lo que hay que comprobar es que no queda NADA de estas pruebas, no que la base
  // este vacia: en produccion hay suscriptores y reservas reales que deben seguir ahi.
  const { count: subsPrueba } = await db
    .from("subscribers")
    .select("*", { count: "exact", head: true })
    .like("email", "%@ejemplo.test");
  const { count: resPrueba } = await db
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .like("holder_email", "%@ejemplo.test");
  // No se exige que app_settings quede vacia: la clave de puerta real debe seguir
  // ahi. Lo que importa es que no haya quedado la de prueba.
  const { data: claveFinal } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "door_password_hash")
    .maybeSingle();
  const quedoLaDePrueba =
    typeof claveFinal?.value === "string" &&
    (await import("@/lib/auth")).verifyPassword("clave-de-prueba-puerta", claveFinal.value);

  ok(
    "no queda ningun dato de prueba",
    subsPrueba === 0 && resPrueba === 0,
    `suscriptores de prueba ${subsPrueba}, reservas de prueba ${resPrueba}`,
  );
  ok(
    "no queda la clave de puerta de prueba",
    !quedoLaDePrueba,
    claveFinal ? "sigue configurada la clave real" : "no hay clave de puerta configurada",
  );

  // Informativo: cuantos datos reales quedan, para notar de un vistazo si una
  // prueba se llevo por delante algo que no era suyo.
  const { count: subsReales } = await db
    .from("subscribers")
    .select("*", { count: "exact", head: true });
  const { count: resReales } = await db
    .from("reservations")
    .select("*", { count: "exact", head: true });
  out.push(`INFO|datos reales intactos|${subsReales} suscriptor(es), ${resReales} reserva(s)`);

  return { out };
});

export const Route = createFileRoute("/__PANEL_CHECKS__")({
  loader: () => correr(),
  component: Resultados,
});

function Resultados() {
  return <pre id="r">{Route.useLoaderData().out.join(String.fromCharCode(10))}</pre>;
}
