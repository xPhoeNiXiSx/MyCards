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
