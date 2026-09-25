import type { QueryRunner } from "@/lib/db";

/**
 * Migrations de *données*, par opposition au schéma de `lib/schema.ts`.
 *
 * Le besoin : la base n'est joignable que depuis les fonctions serveur. Une
 * valeur relevée ailleurs (une cote de produit scellé, par exemple) ne peut
 * donc pas être écrite à la main dans la base ; elle voyage dans le code, et
 * c'est le bouton « Appliquer les migrations » qui la pose.
 *
 * Trois garde-fous, parce qu'on touche ici à des données saisies :
 *
 *  1. Chaque migration porte un identifiant et n'est jouée qu'une fois. Le
 *     registre `data_migrations` s'en souvient, même après redéploiement.
 *  2. Chaque instruction ne remplit que du vide (`... is null`). Une valeur
 *     déjà saisie n'est jamais écrasée, même si la migration rejouait.
 *  3. Rien n'est jamais supprimé, et le nombre de lignes touchées est
 *     conservé : on peut toujours vérifier après coup ce qui s'est passé.
 */

export type DataMigration = {
  id: string;
  /** Ce que la migration fait, en une phrase, pour le journal. */
  label: string;
  run: (query: QueryRunner) => Promise<number>;
};

export type DataMigrationResult = {
  id: string;
  label: string;
  /** `false` si la migration avait déjà été jouée lors d'un passage précédent. */
  applied: boolean;
  rows: number;
};

/** Cote relevée pour un produit scellé, en centimes. */
type Quote = { name: string; cents: number };

/**
 * Remplit la cote des articles scellés dont la valeur actuelle est encore
 * vide. Le nom est comparé sans tenir compte de la casse : c'est le seul
 * point d'accroche, un produit scellé n'a pas d'identifiant TCGdex.
 */
async function fillSealedQuotes(
  query: QueryRunner,
  quotes: Quote[],
  on: string,
): Promise<number> {
  let touched = 0;

  for (const quote of quotes) {
    const rows = await query<{ id: string }>(
      `update items
          set manual_value_cents = $1,
              manual_value_date  = $2,
              updated_at         = now()
        where kind = 'sealed'
          and manual_value_cents is null
          and lower(name) = lower($3)
       returning id`,
      [quote.cents, on, quote.name],
    );
    touched += rows.length;
  }

  return touched;
}

/**
 * Cotes relevées le 25 septembre 2026 chez des revendeurs français, au prix
 * public constaté. Pour l'ETB 30 ans on retient le prix conseillé constaté
 * (59,99 €) plutôt que le prix des boutiques en rupture, plus haut mais qu'on
 * ne peut pas vérifier.
 */
const SEALED_QUOTES_2026_09_25: Quote[] = [
  { name: "ETB 30ans", cents: 5999 },
  { name: "Blister ME04 Chaos Ascendant", cents: 699 },
  { name: "Blister ME05 Nuit noire", cents: 699 },
  { name: "Blister EV10 Rivalités Destinées", cents: 699 },
  { name: "Tripack ME05 Nuit noire", cents: 1999 },
  { name: "Booster Aventures Ensemble", cents: 599 },
];

export const DATA_MIGRATIONS: DataMigration[] = [
  {
    id: "2026-09-25-cotes-scelle",
    label: "Cotes des produits scellés relevées le 25/09/2026",
    run: (query) =>
      fillSealedQuotes(query, SEALED_QUOTES_2026_09_25, "2026-09-25"),
  },
];

/** Identifiants déjà joués, lus depuis le registre. */
async function alreadyApplied(query: QueryRunner): Promise<Set<string>> {
  const rows = await query<{ id: string }>(`select id from data_migrations`);
  return new Set(rows.map((row) => row.id));
}

export async function runDataMigrations(
  query: QueryRunner,
): Promise<DataMigrationResult[]> {
  const done = await alreadyApplied(query);
  const results: DataMigrationResult[] = [];

  for (const migration of DATA_MIGRATIONS) {
    if (done.has(migration.id)) {
      results.push({
        id: migration.id,
        label: migration.label,
        applied: false,
        rows: 0,
      });
      continue;
    }

    const rows = await migration.run(query);

    // Le registre est écrit après coup : si la migration échoue, elle n'est
    // pas marquée jouée et le prochain clic la reprendra.
    await query(
      `insert into data_migrations (id, label, rows_touched)
       values ($1, $2, $3)
       on conflict (id) do nothing`,
      [migration.id, migration.label, rows],
    );

    results.push({ id: migration.id, label: migration.label, applied: true, rows });
  }

  return results;
}

/** État du registre, pour vérifier après coup ce qui a été posé. */
export async function migrationLedger(
  query: QueryRunner,
): Promise<
  { id: string; label: string; rows_touched: number; applied_at: string }[]
> {
  return query(
    `select id, label, rows_touched, applied_at
       from data_migrations
      order by applied_at`,
  );
}
