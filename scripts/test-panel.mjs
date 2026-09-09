#!/usr/bin/env node
// Pruebas de funcionalidad y seguridad del panel, contra la base de datos real.
//
//   node --env-file=.env scripts/test-panel.mjs
//
// Comprueba que las acciones del panel rechazan a quien no tiene sesión, que la
// validación del servidor no se puede saltar, que los datos se crean y editan
// bien, y que la clave pública de Supabase no ve nada. Crea filas de prueba con
// correos @ejemplo.test y las borra al terminar.
//
// Cómo funciona: las server functions solo existen dentro del servidor, así que
// las comprobaciones viven en una ruta (`tests/panel-checks.route.tsx`) que se
// copia a src/routes/ solo mientras dura la prueba y se borra siempre al acabar.
// Vive fuera de src/routes/ a propósito: contiene borrados y nunca debe
// desplegarse.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN = join(RAIZ, "tests/panel-checks.route.tsx");
const NOMBRE_RUTA = "zz-panel-checks";
const DESTINO = join(RAIZ, `src/routes/${NOMBRE_RUTA}.tsx`);
const ANSI = /\[[0-9;]*m/g;

if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SECRET_KEY"]) {
  console.error("Faltan variables. Ejecuta: node --env-file=.env scripts/test-panel.mjs");
  process.exit(1);
}

function instalarRuta() {
  // El marcador se sustituye por la ruta real para que el router la registre.
  const contenido = readFileSync(ORIGEN, "utf8").replace("/__PANEL_CHECKS__", `/${NOMBRE_RUTA}`);
  writeFileSync(DESTINO, contenido, "utf8");
}

function quitarRuta() {
  if (existsSync(DESTINO)) rmSync(DESTINO);
}

function arrancarDev() {
  const child = spawn(process.execPath, [join(RAIZ, "node_modules/vite/bin/vite.js"), "dev"], {
    cwd: RAIZ,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("El dev server no arrancó")), 120000);
    const onChunk = (b) => {
      const m = /(http:\/\/localhost:\d+)/.exec(b.toString().replace(ANSI, ""));
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
  });

  return { child, url };
}

function pararDev(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function desescapar(html) {
  return html
    .replace(/<!--[^]*?-->/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

let servidor = null;
let correctas = 0;
let fallidas = 0;
let saltadas = 0;

try {
  instalarRuta();
  servidor = arrancarDev();
  const base = await servidor.url;

  for (let i = 0; i < 25; i++) {
    try {
      await fetch(`${base}/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const res = await fetch(`${base}/${NOMBRE_RUTA}`);
  const html = await res.text();
  const pre = /<pre[^>]*>([^]*?)<\/pre>/.exec(html);

  if (!pre) {
    console.error(`No se pudo leer el resultado (status ${res.status}).`);
    console.error(html.slice(0, 800));
    process.exit(1);
  }

  for (const linea of desescapar(pre[1]).split("\n")) {
    if (!linea.trim()) continue;

    if (linea.startsWith("##")) {
      console.log(`\n=== ${linea.slice(2).trim()} ===`);
      continue;
    }

    const [estado, nombre, detalle] = linea.split("|");
    const sufijo = detalle ? `  — ${detalle}` : "";

    if (estado === "SALTADO") {
      saltadas += 1;
      console.log(`  SALTADO ${nombre}${sufijo}`);
    } else if (estado === "OK") {
      correctas += 1;
      console.log(`  OK      ${nombre}${sufijo}`);
    } else {
      fallidas += 1;
      console.log(`  FALLO   ${nombre}${sufijo}`);
    }
  }
} finally {
  pararDev(servidor?.child);
  quitarRuta();
}

console.log(
  `\n${correctas}/${correctas + fallidas} comprobaciones correctas` +
    (saltadas > 0 ? `, ${saltadas} saltada(s)` : ""),
);
process.exit(fallidas > 0 ? 1 : 0);
