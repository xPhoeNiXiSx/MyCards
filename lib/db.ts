import { neon } from "@neondatabase/serverless";

import {
  runDataMigrations,
  type DataMigrationResult,
} from "@/lib/data-migrations";
import { SCHEMA_STATEMENTS } from "@/lib/schema";

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

/**
 * Applique le schéma, puis les migrations de données. Rejouable : chaque
 * instruction de schéma est idempotente, et chaque migration de données ne
 * part qu'une fois (registre `data_migrations`).
 *
 * Les instructions partent une par une, et pas en un seul bloc, parce que le
 * pilote HTTP de Neon refuse les requêtes multi-instructions.
 */
export async function runMigrations(): Promise<DataMigrationResult[]> {
  for (const statement of SCHEMA_STATEMENTS) {
    await query(statement);
  }

  // Les migrations de données viennent après le schéma : elles écrivent dans
  // des colonnes que le schéma vient peut-être tout juste de créer.
  return runDataMigrations(query);
}

/** `true` si la table principale existe déjà. */
export async function isSchemaReady(): Promise<boolean> {
  const rows = await query<{ present: boolean }>(
    `select to_regclass('public.items') is not null as present`,
  );
  return rows[0]?.present === true;
}
