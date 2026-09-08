#!/usr/bin/env node
// Convierte la clave compartida del panel de admin en un hash para guardar en
// ADMIN_PASSWORD_HASH. La clave en texto plano no se guarda en ningún sitio.
//
//   node scripts/hash-password.mjs
//
// Pide la clave sin mostrarla en pantalla y sin dejarla en el historial del
// terminal. Genera también un SESSION_SECRET por si aún no tienes uno.

import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const MIN_LENGTH = 10;

/** Lee una línea ocultando lo que se teclea. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });

    // Silencia el eco: readline sigue recibiendo las teclas, pero no las pinta.
    const onWrite = (chunk, encoding, callback) => {
      if (rl.line.length > 0) stdout.write("*", encoding, callback);
      else callback?.();
    };
    const original = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (text) => {
      if (text.includes(question)) original?.(text);
      else onWrite("", "utf8", undefined);
    };

    rl.question(question, (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function main() {
  if (!stdin.isTTY) {
    console.error(
      "Este script pide la clave por teclado: ejecútalo directamente en tu terminal\n" +
        "(no con una tubería ni redirigiendo la entrada).",
    );
    process.exit(1);
  }

  console.log("\nClave compartida del panel de administración de Nemorphic.");
  console.log("No se guarda en ningún archivo: solo se guarda su hash.\n");

  const password = await askHidden("Escribe la clave: ");
  if (password.length < MIN_LENGTH) {
    console.error(`\nDemasiado corta: mínimo ${MIN_LENGTH} caracteres.`);
    process.exit(1);
  }

  const repeat = await askHidden("Escríbela otra vez: ");
  if (password !== repeat) {
    console.error("\nNo coinciden. Vuelve a intentarlo.");
    process.exit(1);
  }

  console.log("\nCopia estas dos líneas en tu archivo .env y en Vercel:\n");
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
  console.log(`SESSION_SECRET=${randomBytes(32).toString("hex")}`);
  console.log("\n(Si ya tenías un SESSION_SECRET funcionando, conserva el tuyo:");
  console.log(" cambiarlo cierra todas las sesiones abiertas del panel.)\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
