#!/usr/bin/env node
// Comprueba qué migraciones están aplicadas en la base de Supabase.
//
//   node --env-file=.env scripts/db-status.mjs
//
// Las migraciones se aplican a mano desde el SQL Editor de Supabase (la clave de
// servicio habla por PostgREST, que no permite crear ni alterar tablas). Este
// script comprueba el resultado: si una columna o tabla esperada no está, dice
// qué archivo hay que pegar.

import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY.\n" +
      "Ejecuta con: node --env-file=.env scripts/db-status.mjs",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

/** Cada migración se reconoce por algo que debe existir después de aplicarla. */
const MIGRACIONES = [
  {
    archivo: "0001_reservas.sql",
    descripcion: "tablas de boletín, eventos y reservas",
    comprobaciones: [
      { tabla: "subscribers", columnas: "id, email, status" },
      { tabla: "events", columnas: "id, slug, name" },
      { tabla: "reservations", columnas: "id, code, tickets" },
      { tabla: "reservation_guests", columnas: "id, name, position" },
    ],
  },
  {
    archivo: "0002_suscriptores_nombre.sql",
    descripcion: "nombre de la persona suscrita, para personalizar el boletín",
    comprobaciones: [{ tabla: "subscribers", columnas: "name" }],
  },
  {
    archivo: "0003_pagos_y_puerta.sql",
    descripcion: "precios por evento, estado de pago y clave de acceso de puerta",
    comprobaciones: [
      { tabla: "events", columnas: "presale_price, door_price" },
      { tabla: "reservations", columnas: "paid, paid_at, paid_by, checked_in_at, checked_in_by" },
      { tabla: "app_settings", columnas: "key, value" },
    ],
  },
];

let pendientes = 0;

for (const migracion of MIGRACIONES) {
  const fallos = [];

  for (const { tabla, columnas } of migracion.comprobaciones) {
    const { error } = await supabase.from(tabla).select(columnas).limit(1);
    if (error) fallos.push(`${tabla} (${error.message})`);
  }

  if (fallos.length === 0) {
    console.log(`  aplicada    ${migracion.archivo}  — ${migracion.descripcion}`);
  } else {
    pendientes += 1;
    console.log(`  PENDIENTE   ${migracion.archivo}  — ${migracion.descripcion}`);
    for (const fallo of fallos) console.log(`                falta: ${fallo}`);
  }
}

if (pendientes > 0) {
  console.log(
    `\n${pendientes} migración(es) pendiente(s). Para aplicarlas:\n` +
      "  1. Abre el SQL Editor de tu proyecto en supabase.com\n" +
      "  2. New query\n" +
      "  3. Pega el contenido del archivo que aparece como PENDIENTE y pulsa Run\n" +
      "  4. Vuelve a ejecutar este script para confirmar",
  );
  process.exit(1);
}

console.log("\nLa base está al día con las migraciones del repo.");
