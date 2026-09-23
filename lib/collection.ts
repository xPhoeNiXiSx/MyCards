import { query } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { readQuote } from "@/lib/pricing";
import { fetchCard, type CardDetail } from "@/lib/tcgdex";

export type ItemKind = "single" | "sealed" | "other";

/** `owned` = dans la collection. `wanted` = sur la liste d'achats. */
export type ItemStatus = "owned" | "wanted";

export const STATUSES: ItemStatus[] = ["owned", "wanted"];

export const KIND_LABELS: Record<ItemKind, string> = {
  single: "Carte à l'unité",
  sealed: "Scellé",
  other: "Autre",
};

export type Item = {
  id: string;
  status: ItemStatus;
  kind: ItemKind;
  name: string;
  cardId: string | null;
  setName: string | null;
  quantity: number;
  purchasePriceCents: number;
  purchaseDate: string | null;
  manualValueCents: number | null;
  manualValueDate: string | null;
  imageUrl: string | null;
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
  /** Visuel à afficher : l'URL saisie, sinon celui de la carte chez TCGdex. */
  image: string | null;
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
  /**
   * Lignes à 0 € d'achat. Un prix laissé vide est enregistré à zéro : sans ce
   * compteur, il disparaît silencieusement du total investi.
   */
  withoutPriceCount: number;
};

type Row = {
  id: string;
  status: ItemStatus;
  kind: ItemKind;
  name: string;
  card_id: string | null;
  set_name: string | null;
  quantity: number;
  purchase_price_cents: number;
  purchase_date: string | Date | null;
  manual_value_cents: number | null;
  manual_value_date: string | Date | null;
  image_url: string | null;
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
    status: row.status,
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
    imageUrl: row.image_url,
    notes: row.notes,
  };
}

const COLUMNS = `id, status, kind, name, card_id, set_name, quantity,
                 purchase_price_cents, purchase_date,
                 manual_value_cents, manual_value_date, image_url, notes`;

/** Les articles d'un statut donné, du plus récent au plus ancien. */
export async function listItems(
  status: ItemStatus = "owned",
): Promise<Item[]> {
  const rows = await query<Row>(
    `select ${COLUMNS} from items where status = $1 order by created_at desc`,
    [status],
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
    `insert into items (status, kind, name, card_id, set_name, quantity,
                        purchase_price_cents, purchase_date,
                        manual_value_cents, manual_value_date, image_url, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning ${COLUMNS}`,
    [
      input.status,
      input.kind,
      input.name,
      input.cardId,
      input.setName,
      input.quantity,
      input.purchasePriceCents,
      input.purchaseDate,
      input.manualValueCents,
      input.manualValueDate,
      input.imageUrl,
      input.notes,
    ],
  );
  return toItem(rows[0]);
}

export async function updateItem(id: string, input: ItemInput): Promise<void> {
  await query(
    `update items
        set status = $2, kind = $3, name = $4, card_id = $5, set_name = $6,
            quantity = $7, purchase_price_cents = $8, purchase_date = $9,
            manual_value_cents = $10, manual_value_date = $11,
            image_url = $12, notes = $13,
            updated_at = now()
      where id = $1`,
    [
      id,
      input.status,
      input.kind,
      input.name,
      input.cardId,
      input.setName,
      input.quantity,
      input.purchasePriceCents,
      input.purchaseDate,
      input.manualValueCents,
      input.manualValueDate,
      input.imageUrl,
      input.notes,
    ],
  );
}

export async function deleteItem(id: string): Promise<void> {
  await query(`delete from items where id = $1`, [id]);
}

/**
 * Récupère les fiches des cartes à l'unité, pour leur cote et leur visuel.
 *
 * TCGdex n'expose pas de requête groupée : c'est un appel par carte, mis en
 * cache une heure par `fetch`. Une fiche indisponible n'est jamais bloquante,
 * la ligne perd simplement sa cote et son image automatiques.
 */
async function fetchCards(cardIds: string[]): Promise<Map<string, CardDetail>> {
  const cards = new Map<string, CardDetail>();

  const results = await Promise.allSettled(
    cardIds.map(async (cardId) => ({ cardId, card: await fetchCard(cardId) })),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[collection] carte indisponible", result.reason);
      continue;
    }
    cards.set(result.value.cardId, result.value.card);
  }

  return cards;
}

/**
 * Applique la valeur manuelle si elle existe, sinon la cote marché, et
 * résout le visuel de chaque ligne.
 */
export async function valuate(items: Item[]): Promise<ValuedItem[]> {
  // Toutes les cartes identifiées, même valorisées à la main : leur fiche
  // porte aussi le visuel.
  const cardIds = [
    ...new Set(
      items
        .filter((item) => item.cardId)
        .map((item) => item.cardId as string),
    ),
  ];

  const cards =
    cardIds.length > 0 ? await fetchCards(cardIds) : new Map<string, CardDetail>();

  return items.map((item) => {
    const card = item.cardId ? cards.get(item.cardId) : undefined;
    const quote = card ? readQuote(card.pricing) : undefined;

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
      // L'URL saisie prime : elle est le choix explicite de l'utilisateur.
      image: item.imageUrl ?? imageUrl(card?.image) ?? null,
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
      withoutPriceCount:
        summary.withoutPriceCount + (item.purchasePriceCents === 0 ? 1 : 0),
    }),
    {
      itemCount: 0,
      unitCount: 0,
      totalPurchaseCents: 0,
      totalValueCents: 0,
      gainCents: 0,
      unvaluedCount: 0,
      withoutPriceCount: 0,
    },
  );
}

export type KindBreakdown = {
  kind: ItemKind;
  /** Lignes d'inventaire, et articles réellement possédés. */
  lines: number;
  units: number;
  purchaseCents: number;
  /** Ne totalise que les lignes valorisées. */
  valueCents: number;
  /** Part de la valeur totale, en pourcentage entier. */
  share: number;
};

/** Répartition de l'inventaire par type d'article, la plus grosse d'abord. */
export function breakdown(items: ValuedItem[]): KindBreakdown[] {
  const kinds = new Map<ItemKind, KindBreakdown>();

  for (const item of items) {
    const row = kinds.get(item.kind) ?? {
      kind: item.kind,
      lines: 0,
      units: 0,
      purchaseCents: 0,
      valueCents: 0,
      share: 0,
    };

    row.lines += 1;
    row.units += item.quantity;
    row.purchaseCents += item.totalPurchaseCents;
    row.valueCents += item.totalValueCents ?? 0;
    kinds.set(item.kind, row);
  }

  const total = [...kinds.values()].reduce(
    (sum, row) => sum + row.valueCents,
    0,
  );

  return [...kinds.values()]
    .map((row) => ({
      ...row,
      // Sans valeur connue nulle part, une part n'aurait aucun sens.
      share: total === 0 ? 0 : Math.round((row.valueCents / total) * 100),
    }))
    .sort((a, b) => b.valueCents - a.valueCents);
}

/** La ligne à la plus forte plus-value. `undefined` si aucune n'est valorisée. */
export function bestGain(items: ValuedItem[]): ValuedItem | undefined {
  return items
    .filter((item) => item.gainCents !== null)
    .sort((a, b) => (b.gainCents ?? 0) - (a.gainCents ?? 0))[0];
}

/**
 * Fait passer un article visé dans la collection.
 *
 * Seuls le prix payé et la date changent : le nom, l'identifiant et le reste
 * suivent la ligne, ce qui est tout l'intérêt d'un statut plutôt que de deux
 * tables.
 */
export async function markAsOwned(
  id: string,
  purchasePriceCents: number,
  purchaseDate: string | null,
): Promise<void> {
  await query(
    `update items
        set status = 'owned',
            purchase_price_cents = $2,
            purchase_date = $3,
            updated_at = now()
      where id = $1 and status = 'wanted'`,
    [id, purchasePriceCents, purchaseDate],
  );
}
