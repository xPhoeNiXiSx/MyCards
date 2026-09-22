import { NextResponse } from "next/server";

import { fetchSet } from "@/lib/tcgdex";

/** Les cartes d'un set, chargées à l'ouverture de son accordéon. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    return json(await fetchSet(id));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/sets]", id, error);
    return json({ error: message }, 502);
  }
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
