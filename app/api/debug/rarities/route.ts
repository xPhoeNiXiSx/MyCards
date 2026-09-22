import { NextResponse } from "next/server";

/**
 * Détermine comment construire un filtre par rareté.
 *
 * La liste des cartes d'un set ne porte pas la rareté : il faut savoir si
 * l'API sait filtrer elle-même, et sur quels champs. Cette route essaie les
 * combinaisons plausibles et rapporte ce qui répond.
 *
 *   /api/debug/rarities?set=30th
 */
const API = "https://api.tcgdex.net/v2/fr";

async function probe(path: string) {
  try {
    const response = await fetch(`${API}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) return { path, statut: response.status };

    const body = await response.json();
    const taille = Array.isArray(body) ? body.length : null;
    return {
      path,
      statut: response.status,
      taille,
      extrait: Array.isArray(body) ? body.slice(0, 3) : body,
    };
  } catch (error) {
    return { path, erreur: error instanceof Error ? error.message : "inconnu" };
  }
}

export async function GET(request: Request) {
  const setId = new URL(request.url).searchParams.get("set") ?? "30th";

  const rarities = await probe("/rarities");
  const premiere =
    Array.isArray(rarities.extrait) && typeof rarities.extrait[0] === "string"
      ? (rarities.extrait[0] as string)
      : "Commune";

  // Une rareté que toutes les collections possèdent : un résultat vide sur
  // « Commune » est un vrai échec, pas une collection qui n'en contient pas.
  const courante = "Commune";

  const essais = await Promise.all([
    probe(`/cards?set=eq:${encodeURIComponent(setId)}`),
    probe(`/cards?rarity=eq:${encodeURIComponent(premiere)}`),
    // Les deux encodages, côte à côte : deux-points littéraux et `%20` contre
    // la sortie de `URLSearchParams`, `%3A` et `+`.
    probe(
      `/cards?set=eq:${encodeURIComponent(setId)}&rarity=eq:${encodeURIComponent(courante)}`,
    ),
    probe(
      `/cards?${new URLSearchParams({ set: `eq:${setId}`, rarity: `eq:${courante}` }).toString()}`,
    ),
    probe(`/sets/${encodeURIComponent(setId)}?rarity=eq:${encodeURIComponent(courante)}`),
  ]);

  return NextResponse.json(
    { raretes: rarities, rareteTestee: premiere, rareteCourante: "Commune", essais },
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}
