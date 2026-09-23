import { query } from "@/lib/db";
import type { Summary } from "@/lib/collection";

/**
 * Historique de l'inventaire, pour la courbe du tableau de bord.
 *
 * Deux séries, de natures différentes :
 *
 * - **l'investi** se reconstitue à tout moment depuis les dates d'achat : la
 *   courbe remonte donc jusqu'au premier achat dès le premier affichage ;
 * - **la valeur** dépend de la cote du jour, que personne ne fournit a
 *   posteriori : elle n'existe qu'à partir du moment où on la relève.
 *
 * Les jours sont ceux de Paris : un relevé fait à 1 h du matin appartient au
 * jour qui commence, pas à la veille en UTC.
 */

export type Point = {
  /** Jour, au format AAAA-MM-JJ. */
  day: string;
  cents: number;
};

const TODAY = `(now() at time zone 'Europe/Paris')::date`;

function isoDay(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

/**
 * Relève la valeur du jour. Rejouable : un second relevé le même jour
 * remplace le premier, le dernier chiffre connu de la journée fait foi.
 */
export async function recordSnapshot(summary: Summary): Promise<void> {
  await query(
    `insert into value_snapshots
       (day, value_cents, purchase_cents, valued_purchase_cents, unvalued_count)
     values (${TODAY}, $1, $2, $3, $4)
     on conflict (day) do update
       set value_cents = excluded.value_cents,
           purchase_cents = excluded.purchase_cents,
           valued_purchase_cents = excluded.valued_purchase_cents,
           unvalued_count = excluded.unvalued_count,
           recorded_at = now()`,
    [
      summary.totalValueCents,
      summary.totalPurchaseCents,
      summary.valuedPurchaseCents,
      summary.unvaluedCount,
    ],
  );
}

/** La valeur relevée, jour par jour, du plus ancien au plus récent. */
export async function valueSeries(): Promise<Point[]> {
  const rows = await query<{ day: string | Date; value_cents: string | number }>(
    `select day, value_cents from value_snapshots order by day`,
  );
  return rows.map((row) => ({
    day: isoDay(row.day),
    cents: Number(row.value_cents),
  }));
}

/**
 * L'investi cumulé, jour par jour : un point par jour d'achat.
 *
 * Un article sans date d'achat compte au jour de sa saisie : c'est la
 * meilleure approximation disponible, et l'oublier ferait mentir la courbe
 * sur le total d'aujourd'hui.
 */
export async function investedSeries(): Promise<Point[]> {
  const rows = await query<{ day: string | Date; cents: string | number }>(
    `select coalesce(purchase_date, (created_at at time zone 'Europe/Paris')::date) as day,
            sum(purchase_price_cents::bigint * quantity) as cents
       from items
      where status = 'owned'
      group by 1
      order by 1`,
  );

  let total = 0;
  return rows.map((row) => {
    total += Number(row.cents);
    return { day: isoDay(row.day), cents: total };
  });
}

/** Aujourd'hui à Paris, au format AAAA-MM-JJ. */
export function parisToday(now = new Date()): string {
  // `sv-SE` formate en AAAA-MM-JJ, ce qu'aucune locale française ne fait.
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}
