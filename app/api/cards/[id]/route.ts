import { NextResponse } from "next/server";

import { readQuote } from "@/lib/pricing";
import { fetchCard } from "@/lib/tcgdex";

/**
 * Fiche d'une carte réduite à ce que la recherche d'ajout affiche : nom,
 * extension, rareté et cote. La cote est lue ici, par le même code que
 * l'inventaire, pour que le chiffre annoncé soit celui qui sera retenu.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const card = await fetchCard(id);
    const quote = readQuote(card.pricing);
    return json({
      id: card.id,
      localId: card.localId,
      name: card.name,
      image: card.image ?? null,
      rarity: card.rarity ?? null,
      setName: card.set?.name ?? null,
      quoteCents: quote?.cents ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/cards]", id, error);
    return json({ error: message }, 502);
  }
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
