import { NextResponse } from "next/server";

import { fetchRarities } from "@/lib/tcgdex";

/** La liste des raretés, pour alimenter le filtre. */
export async function GET() {
  try {
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
