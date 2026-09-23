import { NextResponse } from "next/server";

import { searchCards } from "@/lib/tcgdex";

/** En dessous, une recherche renverrait une bonne part du catalogue. */
const MIN_QUERY = 2;

/**
 * Recherche de cartes par nom dans tout le catalogue : `?q=pikachu`, et
 * `&rarity=` pour se limiter à une rareté. Le tri et la pagination se font
 * côté navigateur, qui connaît l'ordre des sets.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const rarity = params.get("rarity");

  if (q.length < MIN_QUERY) return json({ cards: [] });

  try {
    return json({ cards: await searchCards(q, rarity) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/search]", q, error);
    return json({ error: message }, 502);
  }
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
