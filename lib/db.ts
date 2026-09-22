import { neon } from "@neondatabase/serverless";

/**
 * Accès Postgres. Une seule fonction `query`, volontairement bas niveau :
 * elle permet de rejouer exactement les mêmes requêtes contre une base de test
 * en mémoire (voir `scripts/test-db.mjs`), ce qu'un client à template balisé
 * ne permettrait pas aussi simplement.
 */

export type QueryRunner = <T>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

let runner: QueryRunner | undefined;

/** Permet aux tests d'injecter une base locale à la place de Neon. */
export function setQueryRunner(custom: QueryRunner): void {
  runner = custom;
}

function neonRunner(): QueryRunner {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL n'est pas définie. Ajoute la chaîne de connexion Postgres dans les variables d'environnement Vercel.",
    );
  }

  const sql = neon(url);
  return async <T>(text: string, params: unknown[] = []) =>
    (await sql.query(text, params)) as T[];
}

export async function query<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  runner ??= neonRunner();
  return runner<T>(text, params);
}

/** `true` si une base est configurée, sans tenter de s'y connecter. */
export function isDatabaseConfigured(): boolean {
  return Boolean(runner ?? process.env.DATABASE_URL);
}
