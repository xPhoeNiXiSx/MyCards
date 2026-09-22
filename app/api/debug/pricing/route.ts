import { NextResponse } from "next/server";

import { readQuote } from "@/lib/pricing";
import { fetchCard } from "@/lib/tcgdex";

/**
 * Renvoie l'objet `pricing` brut d'une carte, à côté de ce que le lecteur en
 * tire. Sert à caler `lib/pricing.ts` sur la vraie forme de la réponse TCGdex,
 * qui n'est pas encore documentée de façon stable.
 *
 * Exemple : /api/debug/pricing?id=30c-015
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Paramètre `id` manquant, ex. /api/debug/pricing?id=30c-015" },
      { status: 400 },
    );
  }

  try {
    const card = await fetchCard(id);
    return NextResponse.json({
      id: card.id,
      name: card.name,
      pricing: card.pricing ?? null,
      lu: readQuote(card.pricing) ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    );
  }
}
