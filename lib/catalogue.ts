/**
 * Règles d'affichage du catalogue. Fonctions pures, utilisables côté
 * navigateur : aucune dépendance serveur.
 */

import { setIdOf } from "@/lib/card-number";

type Serie = { id: string; name: string; sets: { id: string }[] };

/**
 * Pokémon TCG Pocket, le jeu mobile : ses extensions n'existent pas en
 * cartes physiques. TCGdex la range sous l'identifiant `tcgp` ; le nom sert
 * de filet si l'identifiant venait à changer.
 */
export function isPocketSerie(serie: { id: string; name: string }): boolean {
  return serie.id === "tcgp" || /pocket/i.test(serie.name);
}

/**
 * Sélection par défaut, tant que rien n'a été choisi : la série la plus
 * récente (la première, le catalogue étant trié du plus récent au plus
 * ancien) et les extensions dont une carte est déjà dans l'inventaire.
 */
export function defaultSelection(series: Serie[], ownedCardIds: string[]): string[] {
  const owned = new Set(
    ownedCardIds.map((id) => setIdOf(id)).filter((id) => id !== null),
  );
  const ids = [
    ...(series[0]?.sets.map((set) => set.id) ?? []),
    ...series.flatMap((serie) => serie.sets.map((set) => set.id)).filter((id) => owned.has(id)),
  ];
  return [...new Set(ids)];
}

/** Ne garde que les extensions choisies, et les séries qui en contiennent. */
export function selectSeries<T extends Serie>(series: T[], selected: Set<string>): T[] {
  return series
    .map((serie) => ({ ...serie, sets: serie.sets.filter((set) => selected.has(set.id)) }))
    .filter((serie) => serie.sets.length > 0);
}
