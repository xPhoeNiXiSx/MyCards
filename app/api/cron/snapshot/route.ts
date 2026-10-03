import { NextResponse, type NextRequest } from "next/server";

import { listItems, summarize, valuate } from "@/lib/collection";
import { recordItemValues, recordSnapshot } from "@/lib/history";
import { safeEquals } from "@/lib/session";

/**
 * Relevé quotidien de la valeur, appelé par le cron Vercel (`vercel.json`).
 *
 * Le tableau de bord relève aussi la valeur à chaque affichage ; ce passage
 * nocturne couvre les jours où personne ne l'ouvre, sans quoi la courbe
 * aurait des trous.
 *
 * Cette route échappe à la session (voir `proxy.ts`) : un cron ne se connecte
 * pas. Elle exige à la place le secret que Vercel envoie dans l'en-tête
 * `Authorization`, et refuse tout sans `CRON_SECRET` configuré.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEquals(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const items = await valuate(await listItems());
    const summary = summarize(items);
    await recordSnapshot(summary);
    // La cote de chaque article, pour la courbe de sa fiche.
    await recordItemValues(items);
    return NextResponse.json({
      valueCents: summary.totalValueCents,
      purchaseCents: summary.totalPurchaseCents,
    });
  } catch (error) {
    console.error("[cron/snapshot]", error);
    return NextResponse.json({ error: "Relevé impossible." }, { status: 500 });
  }
}
