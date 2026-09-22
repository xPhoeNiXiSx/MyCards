/**
 * TCGdex renvoie les URL d'images sans extension : c'est au client de choisir
 * la qualité et le format. Sans ça, l'URL brute renvoie un 404.
 *
 * Volontairement isolé du reste du client TCGdex, qui ne tourne que côté
 * serveur : ces deux fonctions sont utilisées dans le bundle navigateur.
 */

/** Visuel d'une carte : qualité puis extension. */
export function imageUrl(
  base: string | undefined,
  quality: "low" | "high" = "high",
  ext: "webp" | "png" | "jpg" = "webp",
): string | undefined {
  if (!base) return undefined;
  return `${base}/${quality}.${ext}`;
}

/** Logo ou symbole de set : extension seule, pas de qualité. */
export function assetUrl(
  base: string | undefined,
  ext: "webp" | "png" = "webp",
): string | undefined {
  if (!base) return undefined;
  return `${base}.${ext}`;
}

/**
 * Valide une URL d'image saisie à la main.
 *
 * Seuls `http` et `https` sont acceptés : le champ finit dans le `src` d'une
 * balise `img`, et rien ne justifie d'y laisser passer un autre schéma.
 *
 * Renvoie `undefined` si le champ est vide, `null` si la saisie est
 * inexploitable — même convention que les montants.
 */
export function parseImageUrl(
  input: string | null,
): string | undefined | null {
  if (input === null) return undefined;

  const trimmed = input.trim();
  if (trimmed === "") return undefined;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
