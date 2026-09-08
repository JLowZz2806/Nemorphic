import { Buffer } from "node:buffer";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "node:process";

// `useSession` no es un hook de React, es el helper de sesión de TanStack Start.
// Se importa con alias para que `react-hooks/rules-of-hooks` no lo confunda con un
// hook al llamarlo desde funciones normales del servidor.
import { getRequestIP, useSession as openSession } from "@tanstack/react-start/server";

/** Datos que viajan dentro de la cookie sellada. */
type AdminSessionData = {
  admin?: true;
  /** Momento del login, en milisegundos. */
  at?: number;
};

const SESSION_NAME = "nm_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const MIN_SECRET_LENGTH = 32;

/**
 * Devuelve la configuración de sesión, o `null` si el entorno no está preparado.
 *
 * No lanza a propósito: si faltara la variable, un throw aquí convertiría
 * `/admin` en un error 500 con traza. Devolviendo `null` el sitio se comporta como
 * "no hay sesión" — se redirige al login, que sí explica el problema en un idioma
 * humano.
 */
function getSessionConfig() {
  const password = env["SESSION_SECRET"];
  if (!password || password.length < MIN_SECRET_LENGTH) return null;

  return {
    password,
    name: SESSION_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Los navegadores tratan localhost como contexto seguro, así que esto
      // tampoco estorba en desarrollo.
      secure: true,
    },
  } as const;
}

/** Igual que `getSessionConfig`, pero para las rutas que no pueden continuar sin ella. */
function requireSessionConfig() {
  const config = getSessionConfig();
  if (!config) {
    throw new Error(
      `Falta SESSION_SECRET o tiene menos de ${MIN_SECRET_LENGTH} caracteres. ` +
        "En local va en .env; en producción, en las variables de entorno de Vercel. " +
        "Genérala con `node scripts/hash-password.mjs`.",
    );
  }
  return config;
}

export function isAdminConfigured(): boolean {
  return getSessionConfig() !== null && Boolean(env["ADMIN_PASSWORD_HASH"]);
}

export async function isAdmin(): Promise<boolean> {
  const config = getSessionConfig();
  if (!config) return false;

  const session = await openSession<AdminSessionData>(config);
  return session.data.admin === true;
}

export async function startAdminSession(): Promise<void> {
  const session = await openSession<AdminSessionData>(requireSessionConfig());
  await session.update({ admin: true, at: Date.now() });
}

export async function endAdminSession(): Promise<void> {
  const config = getSessionConfig();
  if (!config) return;

  const session = await openSession<AdminSessionData>(config);
  await session.clear();
}

/**
 * Compara la clave escrita contra el hash guardado.
 * `timingSafeEqual` evita que el tiempo de respuesta revele cuántos caracteres
 * del principio son correctos.
 */
export function verifyAdminPassword(input: string): boolean {
  const stored = env["ADMIN_PASSWORD_HASH"];
  if (!stored) {
    throw new Error(
      "Falta la variable ADMIN_PASSWORD_HASH. Genérala con `node scripts/hash-password.mjs`.",
    );
  }

  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) {
    throw new Error("ADMIN_PASSWORD_HASH tiene un formato inválido; esperado <salt>:<hash>.");
  }

  const expected = Buffer.from(hashHex, "hex");
  let actual: Buffer;
  try {
    actual = scryptSync(input, Buffer.from(saltHex, "hex"), expected.length);
  } catch {
    return false;
  }

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// --- Límite de intentos -----------------------------------------------------
//
// En serverless cada instancia tiene su propio mapa y se reinicia sola, así que
// esto no es una barrera perfecta. Sí frena el caso real que importa: alguien
// probando claves en bucle contra una instancia caliente. Cuando haya base de
// datos conviene moverlo a una tabla.

type Attempt = { count: number; firstAt: number; blockedUntil: number };

const attempts = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

function getClientKey(): string {
  // Vercel siempre pone x-forwarded-for, y el cliente no puede falsificarlo
  // porque el proxy lo reescribe.
  return getRequestIP({ xForwardedFor: true }) ?? "desconocido";
}

function pruneAttempts(now: number): void {
  for (const [key, attempt] of attempts) {
    if (now > attempt.blockedUntil && now - attempt.firstAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

/** Segundos que faltan para poder reintentar, o 0 si se puede intentar ya. */
export function getLoginBlockSeconds(): number {
  const now = Date.now();
  pruneAttempts(now);

  const attempt = attempts.get(getClientKey());
  if (!attempt || now >= attempt.blockedUntil) return 0;

  return Math.ceil((attempt.blockedUntil - now) / 1000);
}

export function registerFailedLogin(): void {
  const now = Date.now();
  const key = getClientKey();
  const attempt = attempts.get(key);

  if (!attempt || now - attempt.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  attempt.count += 1;
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.blockedUntil = now + BLOCK_MS;
    attempt.count = 0;
    attempt.firstAt = now;
  }
}

export function clearFailedLogins(): void {
  attempts.delete(getClientKey());
}
