import { NextResponse } from "next/server";

import { fetchCatalogue } from "@/lib/tcgdex";

/** Le catalogue : toutes les séries, chacune avec ses sets. */
export async function GET() {
  try {
    return json(await fetchCatalogue());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue côté TCGdex.";
    console.error("[api/series]", error);
    return json({ error: message }, 502);
  }
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
