import { NextResponse } from "next/server";

import { readQuote } from "@/lib/pricing";
import {
  fetchAnniversarySet,
  fetchCard,
  fetchSet,
  fetchSets,
  type CardResume,
} from "@/lib/tcgdex";

/**
 * Balaie un set et dit combien de ses cartes portent réellement une cote
 * Cardmarket, avec un exemple brut.
 *
 * Existe parce qu'une carte sans cote ne prouve rien : TCGdex documente que
 * les sorties récentes peuvent ne pas encore être cotées. Il faut donc
 * mesurer, pas échantillonner à la main.
 *
 *   /api/debug/prices              → le set anniversaire, puis repli sur des
 *                                    sets plus anciens si aucune cote n'existe
 *   /api/debug/prices?set=sv03     → un set précis
 *   /api/debug/prices?limit=40     → nombre de cartes examinées (max 60)
 */

type Sample = {
  set: string;
  carte: string;
  cardmarket: unknown;
  lu: ReturnType<typeof readQuote>;
};

/** Examine des cartes en parallèle borné, et compte celles qui sont cotées. */
async function scan(
  setId: string,
  cards: CardResume[],
  limit: number,
): Promise<{ examinees: number; cotees: number; exemple?: Sample }> {
  const subset = cards.slice(0, limit);

  const results = await Promise.allSettled(
    subset.map(async (card) => {
      const detail = await fetchCard(card.id);
      const cardmarket = (detail.pricing as Record<string, unknown> | undefined)
        ?.cardmarket;
      return { card: detail, cardmarket };
    }),
  );

  let cotees = 0;
  let exemple: Sample | undefined;

  for (const result of results) {
    if (result.status === "rejected") continue;
    const { card, cardmarket } = result.value;
    if (cardmarket === null || cardmarket === undefined) continue;

    cotees += 1;
    exemple ??= {
      set: setId,
      carte: `${card.id} — ${card.name}`,
      cardmarket,
      lu: readQuote(card.pricing),
    };
  }

  return { examinees: subset.length, cotees, exemple };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? "24"), 1), 60);
  const explicitSet = params.get("set");

  try {
    const target = explicitSet
      ? await fetchSet(explicitSet)
      : (await fetchAnniversarySet()).set;

    const principal = await scan(target.id, target.cards, limit);

    // Une cote trouvée, ou un set imposé : on répond tel quel.
    if (principal.exemple || explicitSet) {
      return json({
        set: { id: target.id, name: target.name },
        ...principal,
      });
    }

    // Sinon on cherche un exemple ailleurs : il faut bien une vraie réponse
    // cotée quelque part pour valider le lecteur.
    const sets = await fetchSets();
    const anciens = sets
      .filter((set) => set.id !== target.id && set.cardCount.official > 20)
      .slice(-6, -1)
      .reverse();

    for (const candidat of anciens) {
      const detail = await fetchSet(candidat.id);
      const essai = await scan(candidat.id, detail.cards, 8);
      if (essai.exemple) {
        return json({
          set: { id: target.id, name: target.name },
          ...principal,
          note: `Aucune cote sur ${target.id}. Exemple pris sur ${candidat.id} (${candidat.name}).`,
          exemple: essai.exemple,
        });
      }
    }

    return json({
      set: { id: target.id, name: target.name },
      ...principal,
      note: "Aucune cote trouvée, ni sur ce set ni sur les sets récents testés.",
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Erreur inconnue." },
      502,
    );
  }
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
