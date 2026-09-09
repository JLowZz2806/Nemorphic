import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "node:process";

// `useSession` no es un hook de React, es el helper de sesión de TanStack Start.
// Se importa con alias para que `react-hooks/rules-of-hooks` no lo confunda con un
// hook al llamarlo desde funciones normales del servidor.
import { getRequestIP, useSession as openSession } from "@tanstack/react-start/server";

/**
 * Hay dos accesos distintos, con cookies distintas a propósito:
 *
 *  - `admin`: el equipo del sello. Ve y edita todo.
 *  - `door` : quien atiende la entrada de un evento. Solo puede marcar ingreso y
 *    pago. Su clave cambia en cada evento y se edita desde el panel.
 *
 * Cookies separadas para que una sesión de puerta nunca pueda confundirse con una
 * de admin, y para que alguien del equipo pueda tener las dos abiertas a la vez.
 */
export type Rol = "admin" | "door";

type SesionData = {
  rol?: Rol;
  /** Compatibilidad con las sesiones emitidas antes de existir los roles. */
  admin?: true;
  at?: number;
};

const COOKIE: Record<Rol, string> = { admin: "nm_admin", door: "nm_door" };

/** La de puerta dura una noche de evento; la de admin, una jornada de trabajo. */
const DURACION_SEGUNDOS: Record<Rol, number> = { admin: 60 * 60 * 8, door: 60 * 60 * 12 };

const MIN_SECRET_LENGTH = 32;

/**
 * Configuración de sesión, o `null` si el entorno no está preparado.
 *
 * No lanza a propósito: un throw aquí convertiría `/admin` en un error 500 con
 * traza. Devolviendo `null` el sitio se comporta como "no hay sesión", redirige al
 * login y allí se explica el problema en un idioma humano.
 */
function getSessionConfig(rol: Rol) {
  const password = env["SESSION_SECRET"];
  if (!password || password.length < MIN_SECRET_LENGTH) return null;

  return {
    password,
    name: COOKIE[rol],
    maxAge: DURACION_SEGUNDOS[rol],
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

function requireSessionConfig(rol: Rol) {
  const config = getSessionConfig(rol);
  if (!config) {
    throw new Error(
      `Falta SESSION_SECRET o tiene menos de ${MIN_SECRET_LENGTH} caracteres. ` +
        "En local va en .env; en producción, en las variables de entorno de Vercel. " +
        "Genérala con `node scripts/hash-password.mjs`.",
    );
  }
  return config;
}

// --- Sesiones ---------------------------------------------------------------

async function tieneSesion(rol: Rol): Promise<boolean> {
  const config = getSessionConfig(rol);
  if (!config) return false;

  const session = await openSession<SesionData>(config);
  if (rol === "admin") {
    return session.data.rol === "admin" || session.data.admin === true;
  }
  return session.data.rol === "door";
}

export async function isAdmin(): Promise<boolean> {
  return tieneSesion("admin");
}

export async function isDoor(): Promise<boolean> {
  return tieneSesion("door");
}

export async function startSession(rol: Rol): Promise<void> {
  const session = await openSession<SesionData>(requireSessionConfig(rol));
  await session.update({ rol, at: Date.now() });
}

export async function endSession(rol: Rol): Promise<void> {
  const config = getSessionConfig(rol);
  if (!config) return;

  const session = await openSession<SesionData>(config);
  await session.clear();
}

// Nombres antiguos, para no tocar las llamadas ya existentes del panel.
export const startAdminSession = () => startSession("admin");
export const endAdminSession = () => endSession("admin");

export function isAdminConfigured(): boolean {
  return getSessionConfig("admin") !== null && Boolean(env["ADMIN_PASSWORD_HASH"]);
}

// --- Claves -----------------------------------------------------------------

/** Formato guardado: "<saltHex>:<hashHex>". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/**
 * Compara una clave contra su hash.
 *
 * `timingSafeEqual` evita que el tiempo de respuesta revele cuántos caracteres del
 * principio son correctos.
 */
export function verifyPassword(input: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  let actual: Buffer;
  try {
    actual = scryptSync(input, Buffer.from(saltHex, "hex"), expected.length);
  } catch {
    return false;
  }

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** La clave del panel vive en una variable de entorno. */
export function verifyAdminPassword(input: string): boolean {
  const stored = env["ADMIN_PASSWORD_HASH"];
  if (!stored) {
    throw new Error(
      "Falta la variable ADMIN_PASSWORD_HASH. Genérala con `node scripts/hash-password.mjs`.",
    );
  }
  return verifyPassword(input, stored);
}

const CLAVE_PUERTA = "door_password_hash";

/**
 * La clave de puerta vive en la base, no en el entorno: cambia en cada evento y
 * hacerlo por variable de entorno obligaría a redesplegar cada vez.
 */
export async function verifyDoorPassword(input: string): Promise<boolean> {
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
  if (!isDatabaseConfigured()) return false;

  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", CLAVE_PUERTA)
    .maybeSingle();

  // Sin clave configurada, el acceso de puerta está cerrado.
  if (error || !data?.value) return false;

  return verifyPassword(input, data.value);
}

export async function setDoorPassword(password: string): Promise<void> {
  const { getSupabaseAdmin } = await import("@/lib/supabase");

  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .upsert(
      { key: CLAVE_PUERTA, value: hashPassword(password), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) throw new Error(`No se pudo guardar la clave de puerta: ${error.message}`);
}

export async function doorPasswordIsSet(): Promise<boolean> {
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
  if (!isDatabaseConfigured()) return false;

  const { data } = await getSupabaseAdmin()
    .from("app_settings")
    .select("updated_at")
    .eq("key", CLAVE_PUERTA)
    .maybeSingle();

  return Boolean(data);
}

// --- Límite de intentos -----------------------------------------------------
//
// En serverless cada instancia tiene su propio mapa y se reinicia sola, así que
// esto no es una barrera perfecta. Sí frena el caso real que importa: alguien
// probando claves en bucle contra una instancia caliente.

type Intento = { count: number; firstAt: number; blockedUntil: number };

const intentos = new Map<string, Intento>();

const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 8;
const BLOQUEO_MS = 15 * 60 * 1000;

function claveCliente(ambito: Rol): string {
  // Vercel siempre pone x-forwarded-for, y el cliente no puede falsificarlo
  // porque el proxy lo reescribe.
  return `${ambito}:${getRequestIP({ xForwardedFor: true }) ?? "desconocido"}`;
}

function limpiar(ahora: number): void {
  for (const [clave, intento] of intentos) {
    if (ahora > intento.blockedUntil && ahora - intento.firstAt > VENTANA_MS) {
      intentos.delete(clave);
    }
  }
}

/** Segundos que faltan para poder reintentar, o 0 si se puede intentar ya. */
export function getLoginBlockSeconds(ambito: Rol = "admin"): number {
  const ahora = Date.now();
  limpiar(ahora);

  const intento = intentos.get(claveCliente(ambito));
  if (!intento || ahora >= intento.blockedUntil) return 0;

  return Math.ceil((intento.blockedUntil - ahora) / 1000);
}

export function registerFailedLogin(ambito: Rol = "admin"): void {
  const ahora = Date.now();
  const clave = claveCliente(ambito);
  const intento = intentos.get(clave);

  if (!intento || ahora - intento.firstAt > VENTANA_MS) {
    intentos.set(clave, { count: 1, firstAt: ahora, blockedUntil: 0 });
    return;
  }

  intento.count += 1;
  if (intento.count >= MAX_INTENTOS) {
    intento.blockedUntil = ahora + BLOQUEO_MS;
    intento.count = 0;
    intento.firstAt = ahora;
  }
}

export function clearFailedLogins(ambito: Rol = "admin"): void {
  intentos.delete(claveCliente(ambito));
}
