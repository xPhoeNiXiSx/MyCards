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
 *  2. Une migration ne touche jamais une valeur saisie dans l'application.
 *     Elle remplit ce qui est vide, et rafraîchit ce qu'un relevé précédent
 *     avait posé (`value_source = 'auto'`) — rien d'autre.
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
 * Le nom, ramené à sa forme comparable : sans casse, sans espaces de bord,
 * et avec les suites d'espaces réduites à une seule.
 */
const NORMALIZED_NAME = `regexp_replace(btrim(lower(name)), '\\s+', ' ', 'g')`;

/**
 * Pose un relevé de cotes sur les articles scellés.
 *
 * Deux cas sont touchés : la cote encore vide, et celle qu'un relevé
 * précédent avait posée — c'est ce qui permet à un relevé plus frais de
 * rafraîchir l'ensemble d'un coup. Une cote saisie dans l'application est
 * laissée telle quelle : elle fait autorité sur n'importe quel relevé.
 *
 * Le nom est le seul point d'accroche — un produit scellé n'a pas
 * d'identifiant TCGdex — et il vient d'une saisie au clavier : la casse, les
 * espaces en double et les espaces insécables du clavier iOS sont donc
 * neutralisés avant la comparaison. Un libellé qui « ressemble » ne suffit
 * pas pour autant : le reste doit correspondre au caractère près.
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
              value_source       = 'auto',
              updated_at         = now()
        where kind = 'sealed'
          and ${NORMALIZED_NAME} = regexp_replace(btrim(lower($3)), '\\s+', ' ', 'g')
          and (manual_value_cents is null or value_source = 'auto')
       returning id`,
      [quote.cents, on, quote.name],
    );
    touched += rows.length;
  }

  return touched;
}

/**
 * Cotes relevées le 25 septembre 2026 chez des revendeurs français, au prix
 * public constaté.
 *
 * Un relevé plus récent ne remplace pas celui-ci : il s'ajoute à la liste,
 * avec son propre identifiant et sa propre date. C'est ce qui fait qu'un
 * seul clic sur « Appliquer les migrations » rafraîchit tout le scellé, et
 * qu'on peut toujours dire de quand date une cote. Pour l'ETB 30 ans on retient le prix conseillé constaté
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

/**
 * Pose une cote sur les articles dont le nom *décrit* le produit, au lieu de
 * l'égaler.
 *
 * Utile quand le libellé exact n'est pas connu : un ETB peut avoir été saisi
 * « ETB 30ans », « Coffret dresseur d'élite 30 ans » ou « Elite Trainer Box
 * 30th ». Le motif doit donc rester descriptif — un mot qui désigne l'objet
 * *et* un repère d'extension — pour ne pas déborder sur un autre article.
 *
 * Les articles « Autre » sont inclus : ils partagent l'écran du scellé, et un
 * produit mal rangé ne doit pas rester sans cote pour autant.
 */
async function fillByPattern(
  query: QueryRunner,
  /** Le produit : « etb|coffret|dresseur|lite ». */
  object: string,
  /** L'extension : « 30 », « me05 »… Les deux doivent être présents. */
  marker: string,
  cents: number,
  on: string,
): Promise<number> {
  const rows = await query<{ id: string }>(
    `update items
        set manual_value_cents = $1,
            manual_value_date  = $2,
            value_source       = 'auto',
            updated_at         = now()
      where kind in ('sealed', 'other')
        and (manual_value_cents is null or value_source = 'auto')
        and lower(name) ~ $3
        and lower(name) ~ $4
     returning id`,
    [cents, on, object, marker],
  );
  return rows.length;
}

/**
 * Deuxième relevé, du 26 septembre 2026 : les articles que le premier n'avait
 * pas couverts. Les libellés viennent de l'inventaire lui-même, lus à
 * l'écran, et non plus devinés.
 *
 * Les deux boosters à l'unité valent nettement moins que leur prix d'achat :
 * c'est le marché, pas une erreur de relevé. Une correction dans l'app prime
 * sur ce chiffre et ne sera plus jamais écrasée.
 */
const SEALED_QUOTES_2026_09_26: Quote[] = [
  { name: "Booster Évolution Prismatique", cents: 850 },
  { name: "Booster Rivalité Destinées", cents: 699 },
  { name: "Blister ME01", cents: 790 },
  { name: "Tripack ME01", cents: 1999 },
  { name: "Coffret Méga-Kangourex Ex", cents: 2990 },
  { name: "Coffret Mewtwo Ex de la Team Rocket", cents: 2999 },
  { name: "ETB 30ans", cents: 5999 },
];

export const DATA_MIGRATIONS: DataMigration[] = [
  {
    id: "2026-09-25-cotes-scelle",
    label: "Cotes des produits scellés relevées le 25/09/2026",
    run: (query) =>
      fillSealedQuotes(query, SEALED_QUOTES_2026_09_25, "2026-09-25"),
  },
  {
    // La migration précédente n'a pas trouvé l'ETB : elle comparait le nom
    // au caractère près. Celle-ci le décrit — un mot qui désigne un coffret
    // dresseur d'élite, et le repère des 30 ans — plutôt que de le deviner.
    id: "2026-09-26-cote-etb-30ans",
    label: "Cote de l'ETB 30 ans relevée le 25/09/2026",
    run: (query) =>
      fillByPattern(query, "etb|coffret|dresseur|lite", "30", 5999, "2026-09-25"),
  },
  {
    id: "2026-09-26-cotes-scelle",
    label: "Cotes des produits scellés relevées le 26/09/2026",
    run: (query) =>
      fillSealedQuotes(query, SEALED_QUOTES_2026_09_26, "2026-09-26"),
  },
];

/**
 * Horodatage du dernier passage, rangé avec les réglages : le bouton doit
 * pouvoir dire « appliquées le … » même quand il n'y avait rien à poser,
 * ce que le registre des migrations ne raconte pas.
 */
const LAST_RUN_KEY = "migrations.last_run";

export async function lastMigrationRun(
  query: QueryRunner,
): Promise<Date | null> {
  const rows = await query<{ value: unknown }>(
    `select value from app_settings where key = $1`,
    [LAST_RUN_KEY],
  );
  const value = rows[0]?.value;
  if (typeof value !== "string") return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

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

    results.push({
      id: migration.id,
      label: migration.label,
      applied: true,
      rows,
    });
  }

  // L'heure vient de la base, pas de la fonction serverless : c'est la même
  // horloge que les dates déjà stockées.
  await query(
    `insert into app_settings (key, value) values ($1, to_jsonb(now()))
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [LAST_RUN_KEY],
  );

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
