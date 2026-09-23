import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatCents } from "@/lib/money";

/**
 * Relevé brut de l'inventaire : ce que la base contient, ligne par ligne, et
 * l'addition qui en découle.
 *
 * Sert à confronter le total affiché à la somme réelle des prix d'achat. Il
 * lit la table sans passer par les filtres de l'application, pour qu'une ligne
 * écartée par un statut inattendu se voie au lieu de disparaître.
 */
type Row = {
  id: string;
  status: string;
  name: string;
  quantity: number;
  purchase_price_cents: number;
};

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Session requise." }, { status: 401 });
  }

  try {
    const rows = await query<Row>(
      `select id, status, name, quantity, purchase_price_cents
         from items
        order by status, created_at desc`,
    );

    const lignes = rows.map((row) => ({
      nom: row.name,
      statut: row.status,
      quantite: Number(row.quantity),
      prixUnitaire: formatCents(Number(row.purchase_price_cents)),
      totalLigne: formatCents(
        Number(row.purchase_price_cents) * Number(row.quantity),
      ),
      totalLigneCentimes:
        Number(row.purchase_price_cents) * Number(row.quantity),
    }));

    const possedees = lignes.filter((ligne) => ligne.statut === "owned");
    const investi = possedees.reduce(
      (sum, ligne) => sum + ligne.totalLigneCentimes,
      0,
    );

    const parStatut: Record<string, number> = {};
    for (const ligne of lignes) {
      parStatut[ligne.statut] = (parStatut[ligne.statut] ?? 0) + 1;
    }

    return NextResponse.json(
      {
        lignesEnBase: lignes.length,
        parStatut,
        lignesPossedees: possedees.length,
        lignesSansPrix: possedees.filter(
          (ligne) => ligne.totalLigneCentimes === 0,
        ).length,
        investiCalcule: formatCents(investi),
        investiCentimes: investi,
        lignes,
      },
      { headers: { "content-type": "application/json; charset=utf-8" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    );
  }
}
