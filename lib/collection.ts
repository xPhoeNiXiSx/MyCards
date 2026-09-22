import { query } from "@/lib/db";
import { readQuote, type Quote } from "@/lib/pricing";
import { fetchCard } from "@/lib/tcgdex";

export type ItemKind = "single" | "sealed" | "other";

export const KIND_LABELS: Record<ItemKind, string> = {
  single: "Carte à l'unité",
  sealed: "Scellé",
  other: "Autre",
};

export type Item = {
  id: string;
  kind: ItemKind;
  name: string;
  cardId: string | null;
  setName: string | null;
  quantity: number;
  purchasePriceCents: number;
  purchaseDate: string | null;
  manualValueCents: number | null;
  manualValueDate: string | null;
  notes: string | null;
};

export type ItemInput = Omit<Item, "id">;

/** D'où vient la valeur actuelle affichée pour une ligne. */
export type ValueSource = "manual" | "market" | "none";

export type ValuedItem = Item & {
  /** Valeur unitaire actuelle, en centimes. */
  currentUnitCents: number | null;
  valueSource: ValueSource;
  /** Champ TCGdex retenu, quand la cote vient du marché. */
  quoteField: string | null;
  /** Date du relevé Cardmarket, au format ISO. */
  quoteUpdated: string | null;
  totalPurchaseCents: number;
  totalValueCents: number | null;
  gainCents: number | null;
};

export type Summary = {
  itemCount: number;
  unitCount: number;
  totalPurchaseCents: number;
  /** Ne totalise que les lignes effectivement valorisées. */
  totalValueCents: number;
  gainCents: number;
  /** Lignes sans aucune valeur actuelle connue. */
  unvaluedCount: number;
};

type Row = {
  id: string;
  kind: ItemKind;
  name: string;
  card_id: string | null;
  set_name: string | null;
  quantity: number;
  purchase_price_cents: number;
  purchase_date: string | Date | null;
  manual_value_cents: number | null;
  manual_value_date: string | Date | null;
  notes: string | null;
};

/** Postgres peut renvoyer une Date ou une chaîne selon le pilote. */
function toIsoDate(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toItem(row: Row): Item {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    cardId: row.card_id,
    setName: row.set_name,
    quantity: Number(row.quantity),
    purchasePriceCents: Number(row.purchase_price_cents),
    purchaseDate: toIsoDate(row.purchase_date),
    manualValueCents:
      row.manual_value_cents === null ? null : Number(row.manual_value_cents),
    manualValueDate: toIsoDate(row.manual_value_date),
    notes: row.notes,
  };
}

const COLUMNS = `id, kind, name, card_id, set_name, quantity,
                 purchase_price_cents, purchase_date,
                 manual_value_cents, manual_value_date, notes`;

export async function listItems(): Promise<Item[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from items order by created_at desc`,
  );
  return rows.map(toItem);
}

export async function getItem(id: string): Promise<Item | undefined> {
  const rows = await query<Row>(
    `select ${COLUMNS} from items where id = $1`,
    [id],
  );
  return rows[0] ? toItem(rows[0]) : undefined;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const rows = await query<Row>(
    `insert into items (kind, name, card_id, set_name, quantity,
                        purchase_price_cents, purchase_date,
                        manual_value_cents, manual_value_date, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning ${COLUMNS}`,
    [
      input.kind,
      input.name,
      input.cardId,
      input.setName,
      input.quantity,
      input.purchasePriceCents,
      input.purchaseDate,
      input.manualValueCents,
      input.manualValueDate,
      input.notes,
    ],
  );
  return toItem(rows[0]);
}

export async function updateItem(id: string, input: ItemInput): Promise<void> {
  await query(
    `update items
        set kind = $2, name = $3, card_id = $4, set_name = $5, quantity = $6,
            purchase_price_cents = $7, purchase_date = $8,
            manual_value_cents = $9, manual_value_date = $10, notes = $11,
            updated_at = now()
      where id = $1`,
    [
      id,
      input.kind,
      input.name,
      input.cardId,
      input.setName,
      input.quantity,
      input.purchasePriceCents,
      input.purchaseDate,
      input.manualValueCents,
      input.manualValueDate,
      input.notes,
    ],
  );
}

export async function deleteItem(id: string): Promise<void> {
  await query(`delete from items where id = $1`, [id]);
}

/**
 * Récupère les cotes marché des cartes à l'unité.
 *
 * TCGdex n'expose pas de requête groupée : c'est un appel par carte, mis en
 * cache une heure par `fetch`. Une cote indisponible n'est jamais bloquante,
 * la ligne bascule simplement en « non valorisée ».
 */
async function fetchQuotes(cardIds: string[]): Promise<Map<string, Quote>> {
  const quotes = new Map<string, Quote>();

  const results = await Promise.allSettled(
    cardIds.map(async (cardId) => {
      const card = await fetchCard(cardId);
      return { cardId, quote: readQuote(card.pricing) };
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[collection] cote indisponible", result.reason);
      continue;
    }
    const { cardId, quote } = result.value;
    if (quote) quotes.set(cardId, quote);
  }

  return quotes;
}

/** Applique la valeur manuelle si elle existe, sinon la cote marché. */
export async function valuate(items: Item[]): Promise<ValuedItem[]> {
  const cardIds = [
    ...new Set(
      items
        .filter((item) => item.manualValueCents === null && item.cardId)
        .map((item) => item.cardId as string),
    ),
  ];

  const quotes =
    cardIds.length > 0 ? await fetchQuotes(cardIds) : new Map<string, Quote>();

  return items.map((item) => {
    const quote = item.cardId ? quotes.get(item.cardId) : undefined;

    let currentUnitCents: number | null = null;
    let valueSource: ValueSource = "none";
    let quoteField: string | null = null;
    let quoteUpdated: string | null = null;

    if (item.manualValueCents !== null) {
      currentUnitCents = item.manualValueCents;
      valueSource = "manual";
    } else if (quote) {
      currentUnitCents = quote.cents;
      valueSource = "market";
      quoteField = quote.field;
      quoteUpdated = quote.updated ?? null;
    }

    const totalPurchaseCents = item.purchasePriceCents * item.quantity;
    const totalValueCents =
      currentUnitCents === null ? null : currentUnitCents * item.quantity;

    return {
      ...item,
      currentUnitCents,
      valueSource,
      quoteField,
      quoteUpdated,
      totalPurchaseCents,
      totalValueCents,
      gainCents:
        totalValueCents === null ? null : totalValueCents - totalPurchaseCents,
    };
  });
}

export function summarize(items: ValuedItem[]): Summary {
  return items.reduce<Summary>(
    (summary, item) => ({
      itemCount: summary.itemCount + 1,
      unitCount: summary.unitCount + item.quantity,
      totalPurchaseCents: summary.totalPurchaseCents + item.totalPurchaseCents,
      totalValueCents: summary.totalValueCents + (item.totalValueCents ?? 0),
      // La plus-value n'a de sens que sur les lignes valorisées : on exclut
      // aussi leur prix d'achat du calcul, sinon tout apparaît en perte.
      gainCents: summary.gainCents + (item.gainCents ?? 0),
      unvaluedCount:
        summary.unvaluedCount + (item.totalValueCents === null ? 1 : 0),
    }),
    {
      itemCount: 0,
      unitCount: 0,
      totalPurchaseCents: 0,
      totalValueCents: 0,
      gainCents: 0,
      unvaluedCount: 0,
    },
  );
}
