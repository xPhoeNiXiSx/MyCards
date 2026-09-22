import { cookies } from "next/headers";

/**
 * Authentification volontairement minimale : un mot de passe unique, pas de
 * comptes. Il n'y a qu'un utilisateur, et l'inventaire contient des prix
 * d'achat — donc la page collection est entièrement fermée, pas seulement en
 * écriture. La galerie d'accueil, elle, reste publique.
 */

const COOKIE = "mycards_session";
/** 30 jours : on n'est pas sur des données bancaires. */
const MAX_AGE = 60 * 60 * 24 * 30;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} n'est pas définie. Ajoute-la dans les variables d'environnement Vercel.`,
    );
  }
  return value;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("AUTH_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(signature).toString("base64url");
}

/** Comparaison à temps constant, pour ne pas fuiter le mot de passe octet par octet. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function checkPassword(candidate: string): boolean {
  return equals(candidate, requireEnv("APP_PASSWORD"));
}

export async function openSession(): Promise<void> {
  const issued = String(Date.now());
  const token = `${issued}.${await sign(issued)}`;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function closeSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;

  const [issued, signature] = token.split(".");
  if (!issued || !signature) return false;

  if (!equals(signature, await sign(issued))) return false;

  const age = Date.now() - Number(issued);
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE * 1000;
}

/** `true` si les variables d'environnement d'authentification sont en place. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}
