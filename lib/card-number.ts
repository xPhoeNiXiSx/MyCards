/**
 * Lecture du numéro imprimé en bas d'une carte, pour la retrouver dans son
 * extension. Utilisable côté navigateur : aucune dépendance serveur.
 */

/**
 * Forme comparable d'un numéro : « 015/165 », « 15 » et « 015 » désignent la
 * même carte. Les numéros à lettres (« TG05 », « SV045 ») gardent leur
 * préfixe, seuls les zéros de tête de la partie chiffrée tombent.
 */
export function normalizeCardNumber(raw: string): string {
  const number = raw.split("/")[0].trim().toUpperCase().replace(/\s+/g, "");
  const match = /^([A-Z]*)0*(\d+)([A-Z]*)$/.exec(number);
  return match ? `${match[1]}${match[2]}${match[3]}` : number;
}

/** La carte d'un set qui porte ce numéro, s'il y en a une. */
export function findByNumber<T extends { localId: string }>(
  cards: T[],
  raw: string,
): T | undefined {
  const wanted = normalizeCardNumber(raw);
  if (wanted === "") return undefined;
  return cards.find((card) => normalizeCardNumber(card.localId) === wanted);
}

/**
 * Identifiant du set d'une carte TCGdex : tout ce qui précède le dernier
 * tiret (`sv03.5-025` → `sv03.5`). `null` si l'identifiant n'a pas ce format.
 */
export function setIdOf(cardId: string): string | null {
  const cut = cardId.lastIndexOf("-");
  return cut > 0 ? cardId.slice(0, cut) : null;
}
