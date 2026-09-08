#!/usr/bin/env node
// Reprocesa las imágenes de public/Assets: las reduce a un ancho razonable y las
// recomprime, sin cambiar el nombre ni la extensión (así ningún código se rompe).
//
//   node scripts/optimize-images.mjs                 informe, no escribe nada
//   node scripts/optimize-images.mjs --apply         sobrescribe los archivos
//   node scripts/optimize-images.mjs --convert-png   además, PNG sin transparencia → .jpg
//
// --convert-png RENOMBRA archivos: hay que actualizar a mano las referencias que
// el propio script lista al terminar.
//
// Los originales están en git: si algo sale mal, `git checkout public/Assets`.

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import sharp from "sharp";

const APPLY = process.argv.includes("--apply");
const CONVERT_PNG = process.argv.includes("--convert-png");

/** Reglas por carpeta. `maxWidth` se aplica DESPUÉS de auto-orientar. */
const RULES = [
  { dir: "public/Assets/artistas", maxWidth: 1000, quality: 80 },
  { dir: "public/Assets", maxWidth: 1600, quality: 82 },
];

// "Logo con fondo.png" no lo referencia ningún código: se deja intacto por si es
// la copia maestra del logo.
const SKIP = new Set(["favicon.svg", "robots.txt", "Logo con fondo.png"]);
/** Por debajo de esto no vale la pena tocar nada. */
const MIN_BYTES = 150 * 1024;

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function optimize(path, rule) {
  const input = await readFile(path);
  const image = sharp(input).rotate(); // .rotate() sin argumentos = auto-orientar por EXIF
  const meta = await image.metadata();

  // Tras auto-orientar, el ancho puede ser el otro lado del original.
  const oriented = meta.orientation && meta.orientation >= 5;
  const width = oriented ? meta.height : meta.width;

  const resized = width && width > rule.maxWidth ? image.resize({ width: rule.maxWidth }) : image;

  // Un PNG sin transparencia es casi siempre una foto guardada en el formato
  // equivocado: pasarla a JPEG ahorra muchísimo sin perder resolución.
  const convertible = meta.format === "png" && !meta.hasAlpha && CONVERT_PNG;
  const format = meta.format === "png" && !convertible ? "png" : "jpeg";

  const output =
    format === "png"
      ? await resized.png({ compressionLevel: 9, effort: 10 }).toBuffer()
      : await resized.jpeg({ quality: rule.quality, mozjpeg: true }).toBuffer();

  return { before: input.length, after: output.length, output, width, format, convertible };
}

async function main() {
  if (!existsSync("public/Assets")) {
    console.error("No se encontró public/Assets — ejecuta desde la raíz del proyecto.");
    process.exit(1);
  }

  const rows = [];
  const renamed = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const rule of RULES) {
    for (const name of readdirSync(rule.dir)) {
      const path = join(rule.dir, name);
      if (SKIP.has(name) || !statSync(path).isFile()) continue;
      if (!/\.(jpe?g|png)$/i.test(extname(name))) continue;

      const size = statSync(path).size;
      if (size < MIN_BYTES) {
        rows.push({ path, before: size, after: size, note: "ya es pequeña" });
        totalBefore += size;
        totalAfter += size;
        continue;
      }

      const result = await optimize(path, rule);
      const worse = result.after >= result.before;
      const target = result.convertible ? path.replace(/\.png$/i, ".jpg") : path;

      rows.push({
        path,
        before: result.before,
        after: worse ? result.before : result.after,
        note: worse
          ? "sin mejora (se deja igual)"
          : result.convertible
            ? `PNG → ${target.split(/[\\/]/).pop()}`
            : `${result.format}, ancho ${rule.maxWidth}`,
      });

      totalBefore += result.before;
      totalAfter += worse ? result.before : result.after;

      if (APPLY && !worse) {
        await writeFile(target, result.output);
        if (target !== path) {
          unlinkSync(path);
          renamed.push([path, target]);
        }
      }
    }
  }

  const width = Math.max(...rows.map((r) => r.path.length));
  for (const row of rows) {
    const saved = row.before - row.after;
    const pct = saved > 0 ? ` (-${Math.round((saved / row.before) * 100)}%)` : "";
    console.log(
      `${row.path.padEnd(width)}  ${kb(row.before).padStart(8)} → ${kb(row.after).padStart(8)}${pct.padEnd(8)}  ${row.note}`,
    );
  }

  console.log(
    `\nTotal: ${kb(totalBefore)} → ${kb(totalAfter)} ` +
      `(-${Math.round(((totalBefore - totalAfter) / totalBefore) * 100)}%)`,
  );
  if (renamed.length > 0) {
    console.log("\nSe renombraron archivos. Actualiza estas referencias en el código:");
    for (const [from, to] of renamed) console.log(`  ${from}  →  ${to}`);
  }

  console.log(
    APPLY
      ? "\nArchivos sobrescritos. Revisa el resultado en el navegador antes de commitear."
      : "\nInforme solamente. Ejecuta con --apply para escribir los cambios.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
