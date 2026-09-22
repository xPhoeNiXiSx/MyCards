/**
 * Lecture des cotes Cardmarket exposées par TCGdex.
 *
 * La forme exacte du champ `pricing` n'est pas encore figée côté TCGdex (le
 * SDK officiel ne la typait pas encore au moment de l'écriture). Plutôt que de
 * parier sur des noms de clés, on parcourt l'objet et on retient la première
 * valeur numérique dont le nom correspond à une notion de prix connue, par
 * ordre de préférence. Un champ inattendu fait donc dégrader proprement au
 * lieu de casser.
 *
 * La route /api/debug/pricing renvoie l'objet brut pour pouvoir resserrer ce
 * lecteur sur un vrai payload.
 */

/** Par ordre de préférence : la tendance est plus stable que le dernier prix bas. */
const PRICE_KEYS = [
  /^trend(price)?$/,
  /^avg30$/,
  /^avg7$/,
  /^avg1?$/,
  /^average$/,
  /^market$/,
  /^mid$/,
  /^low(price)?$/,
  /^min$/,
];

/** Clés à ignorer : ce sont des métadonnées, pas des prix. */
const IGNORED_KEYS = /^(updated|unit|currency|url|id|date|source)$/i;

type Candidate = { key: string; path: string; value: number };

function collect(node: unknown, path: string[], out: Candidate[]): void {
  if (typeof node === "number") {
    if (!Number.isFinite(node) || node <= 0) return;
    const key = path.at(-1) ?? "";
    if (IGNORED_KEYS.test(key)) return;
    out.push({ key: key.toLowerCase(), path: path.join("."), value: node });
    return;
  }

  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, child] of Object.entries(node)) {
      collect(child, [...path, key], out);
    }
  }
}

export type Quote = {
  /** Valeur en centimes d'euro. */
  cents: number;
  /** Chemin de la clé retenue, pour pouvoir expliquer d'où sort le chiffre. */
  field: string;
};

/**
 * Extrait une cote en euros depuis l'objet `pricing` d'une carte TCGdex.
 * On privilégie les prix de la variante standard : les entrées « holo » ou
 * « reverse » ne sont retenues qu'à défaut.
 */
export function readQuote(pricing: unknown): Quote | undefined {
  if (!pricing || typeof pricing !== "object") return undefined;

  const cardmarket = (pricing as Record<string, unknown>).cardmarket;
  if (!cardmarket) return undefined;

  const candidates: Candidate[] = [];
  collect(cardmarket, [], candidates);
  if (candidates.length === 0) return undefined;

  const isVariant = (candidate: Candidate) =>
    /holo|reverse|foil|1st|edition/i.test(candidate.path);

  const standard = candidates.filter((candidate) => !isVariant(candidate));
  const pools = standard.length > 0 ? [standard, candidates] : [candidates];

  for (const pool of pools) {
    for (const pattern of PRICE_KEYS) {
      const hit = pool.find((candidate) => pattern.test(candidate.key));
      if (hit) {
        return {
          cents: Math.round(hit.value * 100),
          field: `cardmarket.${hit.path}`,
        };
      }
    }
  }

  return undefined;
}
