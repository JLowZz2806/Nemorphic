#!/usr/bin/env node
// Genera las imágenes que usa la plantilla del boletín.
//
//   node scripts/build-email-assets.mjs
//
// Se generan aquí y se guardan en el repo (no se calculan al enviar) porque un
// correo solo puede enlazar imágenes por URL absoluta: tienen que estar
// publicadas en el sitio antes de mandar nada.
//
// El degradado usa los colores reales del fondo de `Logo con fondo.png`,
// muestreados de la propia imagen: #180848 (dominante), #240853 y #2a0c5d.

import { mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";

import sharp from "sharp";

const SALIDA = "public/Assets/email";

// Se genera al doble del tamaño al que se muestra (600 px de ancho), para que se
// vea nítido en pantallas de alta densidad.
const ANCHO = 1200;
const ALTO = 440;

const degradado = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}">
  <defs>
    <linearGradient id="fondo" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#2a0c5d" />
      <stop offset="45%"  stop-color="#180848" />
      <stop offset="100%" stop-color="#050308" />
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="42%" r="55%">
      <stop offset="0%"   stop-color="#6a3ec0" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#6a3ec0" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)" />
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#halo)" />
</svg>`;

async function main() {
  mkdirSync(SALIDA, { recursive: true });

  const logo = await sharp("public/Assets/logo nemorphic.png")
    .resize({ width: 260, fit: "inside" })
    .toBuffer();

  const cabecera = await sharp(Buffer.from(degradado))
    .composite([{ input: logo, gravity: "center" }])
    // JPEG y no PNG: es una imagen fotográfica (degradado suave) y pesa una
    // fracción. Los correos no deben arrastrar imágenes grandes.
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(`${SALIDA}/cabecera.jpg`);

  // Logo pequeño para la esquina del pie, sobre fondo oscuro.
  const marca = await sharp("public/Assets/logo nemorphic.png")
    .resize({ width: 120, fit: "inside" })
    .flatten({ background: "#050308" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(`${SALIDA}/marca.jpg`);

  for (const [nombre, info] of [
    ["cabecera.jpg", cabecera],
    ["marca.jpg", marca],
  ]) {
    const { size } = await stat(`${SALIDA}/${nombre}`);
    console.log(
      `  ${nombre.padEnd(14)} ${info.width}x${info.height}  ${(size / 1024).toFixed(0)} KB`,
    );
  }

  console.log(
    "\nListo. Las imágenes deben estar desplegadas antes de enviar un boletín:\n" +
      "los clientes de correo las cargan desde la web, no van dentro del mensaje.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
