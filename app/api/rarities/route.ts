import { NextResponse } from "next/server";

import { fetchRarities, fetchRarityCounts } from "@/lib/tcgdex";

/**
 * Sans paramètre : la liste des raretés, pour alimenter le filtre.
 * Avec `?rarity=` : le nombre de cartes de cette rareté par set, qui sert à
 * n'afficher que les collections concernées.
 */
export async function GET(request: Request) {
  const rarity = new URL(request.url).searchParams.get("rarity");

  try {
    if (rarity) return json(await fetchRarityCounts(rarity));
    return json(await fetchRarities());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/rarities]", error);
    return json({ error: message }, 502);
  }
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
