import { NextResponse } from "next/server";

import { fetchAnniversarySet } from "@/lib/tcgdex";

/**
 * On passe par une route serveur plutôt que d'appeler TCGdex depuis le
 * navigateur : pas de dépendance au CORS, une seule réponse mise en cache pour
 * tous les visiteurs, et c'est ici que viendront se greffer les cotes plus tard.
 */
export async function GET() {
  try {
    return json(await fetchAnniversarySet());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/set]", error);
    return json({ error: message }, 502);
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
