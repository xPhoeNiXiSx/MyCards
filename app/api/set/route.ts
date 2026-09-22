import { NextResponse } from "next/server";

import { fetchAnniversarySet } from "@/lib/tcgdex";

/**
 * On passe par une route serveur plutôt que d'appeler TCGdex depuis le
 * navigateur : pas de dépendance au CORS, une seule réponse mise en cache pour
 * tous les visiteurs, et c'est ici que viendront se greffer les cotes plus tard.
 */
export async function GET() {
  try {
    const payload = await fetchAnniversarySet();
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/set]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
