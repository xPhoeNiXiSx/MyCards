import { NextResponse } from "next/server";

import { readQuote } from "@/lib/pricing";
import { fetchAnniversarySet, fetchCard } from "@/lib/tcgdex";

/**
 * Renvoie l'objet `pricing` brut d'une carte, à côté de ce que le lecteur en
 * tire. Sert à caler `lib/pricing.ts` sur la vraie forme de la réponse TCGdex,
 * qui n'est pas encore documentée de façon stable.
 *
 * Sans paramètre, la route résout elle-même le set anniversaire et prend une
 * de ses cartes : inutile de connaître un identifiant à l'avance.
 *
 *   /api/debug/pricing            → une carte du set, choisie automatiquement
 *   /api/debug/pricing?n=12       → la 13e carte du set
 *   /api/debug/pricing?id=30c-015 → une carte précise
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const explicitId = params.get("id");

  try {
    let cardId = explicitId;
    let setInfo: { id: string; name: string; sampleIds: string[] } | undefined;

    if (!cardId) {
      const { set } = await fetchAnniversarySet();
      const index = Number(params.get("n") ?? "0");
      const card =
        set.cards[Number.isInteger(index) && index >= 0 ? index : 0] ??
        set.cards[0];

      if (!card) {
        return json({ error: `Le set ${set.id} ne contient aucune carte.` }, 502);
      }

      cardId = card.id;
      setInfo = {
        id: set.id,
        name: set.name,
        sampleIds: set.cards.slice(0, 5).map((entry) => entry.id),
      };
    }

    const card = await fetchCard(cardId);

    return json({
      set: setInfo,
      carte: { id: card.id, name: card.name },
      pricing: card.pricing ?? null,
      lu: readQuote(card.pricing) ?? null,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Erreur inconnue." },
      502,
    );
  }
}

/**
 * `NextResponse.json` n'annonce pas d'encodage, et les navigateurs affichent
 * alors le JSON en Latin-1 : les accents deviennent illisibles.
 */
function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
