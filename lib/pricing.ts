/**
 * Lecture des cotes Cardmarket exposées par TCGdex.
 *
 * Forme réelle observée sur l'API (objet plat, en euros) :
 *
 *   "cardmarket": {
 *     "updated": "2026-09-21T22:54:33.740Z",
 *     "unit": "EUR",
 *     "idProduct": 886393,
 *     "avg": 0.27, "low": 0.02, "trend": 0.15,
 *     "avg1": 0.02, "avg7": 0.03, "avg30": 0.27,
 *     "avg-holo": 0.07, "low-holo": 0.02, "trend-holo": 0.06, …
 *   }
 *
 * Les variantes holo portent le même nom suffixé de `-holo`. Une carte non
 * encore référencée sur Cardmarket a `cardmarket: null`.
 */

/**
 * Par ordre de préférence. `trend` est la référence de marché de Cardmarket :
 * plus stable qu'un prix bas isolé, plus réactif qu'une moyenne 30 jours.
 */
const PRICE_KEYS = ["trend", "avg7", "avg30", "avg", "avg1", "low"] as const;

export type Quote = {
  /** Valeur en centimes d'euro. */
  cents: number;
  /** Clé retenue, pour pouvoir expliquer d'où sort le chiffre. */
  field: string;
  /** Date du relevé Cardmarket, au format ISO, si l'API la fournit. */
  updated?: string;
};

function numberAt(
  source: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/**
 * Extrait une cote en euros depuis l'objet `pricing` d'une carte TCGdex.
 *
 * Les prix de la variante standard priment ; les clés `-holo` ne servent que
 * si aucune valeur standard n'est disponible.
 */
export function readQuote(pricing: unknown): Quote | undefined {
  if (!pricing || typeof pricing !== "object") return undefined;

  const cardmarket = (pricing as Record<string, unknown>).cardmarket;
  if (!cardmarket || typeof cardmarket !== "object") return undefined;

  const source = cardmarket as Record<string, unknown>;

  // Cardmarket cote en euros. Si l'API annonçait une autre devise, la
  // convertir en centimes d'euro produirait un chiffre faux sans le dire.
  const unit = source.unit;
  if (typeof unit === "string" && unit.toUpperCase() !== "EUR") {
    return undefined;
  }

  const updated = typeof source.updated === "string" ? source.updated : undefined;

  for (const suffix of ["", "-holo"]) {
    for (const key of PRICE_KEYS) {
      const field = `${key}${suffix}`;
      const value = numberAt(source, field);
      if (value !== undefined) {
        return {
          cents: Math.round(value * 100),
          field: `cardmarket.${field}`,
          updated,
        };
      }
    }
  }

  return undefined;
}
