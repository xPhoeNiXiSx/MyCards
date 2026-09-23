import { query } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { readQuote } from "@/lib/pricing";
import { fetchCard, type CardDetail } from "@/lib/tcgdex";

export type ItemKind = "single" | "sealed" | "other";

/** `owned` = dans la collection. `wanted` = sur la liste d'achats. */
export type ItemStatus = "owned" | "wanted";

export const STATUSES: ItemStatus[] = ["owned", "wanted"];

/**
 * Sous-types de scellé. Liste volontairement courte : elle doit couvrir ce
 * qu'on achète couramment sans devenir un catalogue à faire défiler.
 */
export const SEALED_TYPES = {
  booster: "Booster à l'unité",
  blister: "Blister",
  tripack: "Tripack",
  etb: "Coffret dresseur d'élite (ETB)",
  display: "Display",
  coffret: "Coffret / collection spéciale",
  bundle: "Bundle / multipack",
  autre: "Autre scellé",
} as const;

export type SealedType = keyof typeof SEALED_TYPES;

export const SEALED_TYPE_KEYS = Object.keys(SEALED_TYPES) as SealedType[];

export function isSealedType(value: unknown): value is SealedType {
  return typeof value === "string" && value in SEALED_TYPES;
}

/** Langue d'impression. Absente, la carte est supposée française. */
export const LANGUAGES = {
  fr: "Français",
  en: "Anglais",
  ja: "Japonais",
  ko: "Coréen",
  zh: "Chinois",
  de: "Allemand",
  it: "Italien",
  es: "Espagnol",
  pt: "Portugais",
} as const;

export type Language = keyof typeof LANGUAGES;

/** Échelle Cardmarket, de la meilleure à la pire. */
export const CONDITIONS = {
  mt: "Mint",
  nm: "Near Mint",
  ex: "Excellent",
  gd: "Good",
  lp: "Light Played",
  pl: "Played",
  po: "Poor",
} as const;

export type Condition = keyof typeof CONDITIONS;

export const GRADERS = {
  psa: "PSA",
  pca: "PCA",
  cgc: "CGC",
  bgs: "BGS",
  sgc: "SGC",
  ca: "Collect Aura",
  autre: "Autre",
} as const;

export type Grader = keyof typeof GRADERS;

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in LANGUAGES;
}

export function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && value in CONDITIONS;
}

export function isGrader(value: unknown): value is Grader {
  return typeof value === "string" && value in GRADERS;
}

/**
 * Note de gradation : de 1 à 10, demi-points admis (« 9,5 » ou « 9.5 »).
 * Renvoie la note normalisée avec un point, `undefined` si vide, `null` si
 * illisible.
 */
export function parseGrade(raw: string | null): string | null | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = raw.trim().replace(",", ".");
  if (!/^\d{1,2}(\.5)?$/.test(value)) return null;
  const number = Number(value);
  if (number < 1 || number > 10) return null;
  return String(number);
}

/** « PSA 10 », « Collect Aura 9.5 ». `null` pour une carte non gradée. */
export function gradeLabel(item: {
  grader: Grader | null;
  grade: string | null;
}): string | null {
  if (!item.grader || !item.grade) return null;
  return `${GRADERS[item.grader]} ${item.grade.replace(".", ",")}`;
}

/**
 * Ce qui distingue un exemplaire d'un autre : gradation, sinon état, et
 * langue quand elle n'est pas le français. Vide pour une carte ordinaire.
 */
export function editionLabel(item: {
  language: Language | null;
  condition: Condition | null;
  grader: Grader | null;
  grade: string | null;
}): string | null {
  const parts = [
    gradeLabel(item) ?? (item.condition ? CONDITIONS[item.condition] : null),
    item.language && item.language !== "fr" ? LANGUAGES[item.language] : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Codes courts des pastilles. Ceux de Cardmarket pour l'état. */
export const LANGUAGE_CODES: Record<Language, string> = {
  fr: "FR",
  en: "EN",
  ja: "JP",
  ko: "KR",
  zh: "CN",
  de: "DE",
  it: "IT",
  es: "ES",
  pt: "PT",
};

export const CONDITION_CODES: Record<Condition, string> = {
  mt: "MT",
  nm: "NM",
  ex: "EX",
  gd: "GD",
  lp: "LP",
  pl: "PL",
  po: "PO",
};

/** Ce que portent les pastilles d'un article. `null` = pas de pastille. */
export type EditionBadges = {
  /** « PSA 10 ». */
  grade: string | null;
  /** Code de langue, jamais pour le français : c'est le cas par défaut. */
  language: string | null;
  /** Code d'état, jamais pour une gradée : sa note le remplace. */
  condition: string | null;
};

export function editionBadges(item: {
  language: Language | null;
  condition: Condition | null;
  grader: Grader | null;
  grade: string | null;
}): EditionBadges {
  const grade = gradeLabel(item);
  return {
    grade,
    language:
      item.language && item.language !== "fr"
        ? LANGUAGE_CODES[item.language]
        : null,
    condition: !grade && item.condition ? CONDITION_CODES[item.condition] : null,
  };
}

/**
 * Les deux inventaires : les cartes d'un côté, le scellé de l'autre. Ce ne
 * sont pas les mêmes collections, elles ont chacune leur page. « Autre »
 * (goodies, classeurs…) rejoint le scellé : ce ne sont pas des cartes.
 */
export type Scope = "cards" | "sealed";

export const SCOPES: Record<
  Scope,
  { path: string; title: string; kinds: ItemKind[] }
> = {
  cards: { path: "/collection", title: "Ma collection de cartes", kinds: ["single"] },
  sealed: { path: "/scelle", title: "Mon inventaire scellé", kinds: ["sealed", "other"] },
};

export function scopeOf(kind: ItemKind): Scope {
  return kind === "single" ? "cards" : "sealed";
}

export function inScope(item: { kind: ItemKind }, scope: Scope): boolean {
  return scopeOf(item.kind) === scope;
}

export const KIND_LABELS: Record<ItemKind, string> = {
  single: "Carte à l'unité",
  sealed: "Scellé",
  other: "Autre",
};

export type Item = {
  id: string;
  status: ItemStatus;
  kind: ItemKind;
  /** Renseigné pour le scellé uniquement. */
  sealedType: SealedType | null;
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
  /** `null` = non précisé, supposé français. */
  language: Language | null;
  /** État de la carte brute. Sans objet sur une carte gradée. */
  condition: Condition | null;
  /** Gradation : les deux champs vont ensemble, ou aucun. */
  grader: Grader | null;
  grade: string | null;
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
  /**
   * Prix d'achat des seules lignes valorisées. C'est la base à laquelle
   * comparer `totalValueCents` : rapporter une valeur partielle à un
   * investissement total donnerait un pourcentage faux.
   */
  valuedPurchaseCents: number;
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
  sealed_type: string | null;
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
  language: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
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
    sealedType: isSealedType(row.sealed_type) ? row.sealed_type : null,
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
    language: isLanguage(row.language) ? row.language : null,
    condition: isCondition(row.condition) ? row.condition : null,
    grader: isGrader(row.grader) ? row.grader : null,
    grade: row.grade,
  };
}

const COLUMNS = `id, status, kind, sealed_type, name, card_id, set_name, quantity,
                 purchase_price_cents, purchase_date,
                 manual_value_cents, manual_value_date, image_url, notes,
                 language, condition, grader, grade`;

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

/**
 * Exemplaires possédés par carte TCGdex, toutes lignes confondues : le
 * catalogue s'en sert pour signaler une carte déjà dans l'inventaire.
 */
export async function ownedCountsByCard(): Promise<Record<string, number>> {
  const rows = await query<{ card_id: string; quantity: string | number }>(
    `select card_id, sum(quantity) as quantity
       from items
      where status = 'owned' and card_id is not null
      group by card_id`,
  );
  return Object.fromEntries(
    rows.map((row) => [row.card_id, Number(row.quantity)]),
  );
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
    `insert into items (status, kind, sealed_type, name, card_id, set_name,
                        quantity, purchase_price_cents, purchase_date,
                        manual_value_cents, manual_value_date, image_url, notes,
                        language, condition, grader, grade)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17)
     returning ${COLUMNS}`,
    [
      input.status,
      input.kind,
      input.sealedType,
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
      input.language,
      input.condition,
      input.grader,
      input.grade,
    ],
  );
  return toItem(rows[0]);
}

export async function updateItem(id: string, input: ItemInput): Promise<void> {
  await query(
    `update items
        set status = $2, kind = $3, sealed_type = $4, name = $5, card_id = $6,
            set_name = $7, quantity = $8, purchase_price_cents = $9,
            purchase_date = $10, manual_value_cents = $11,
            manual_value_date = $12, image_url = $13, notes = $14,
            language = $15, condition = $16, grader = $17, grade = $18,
            updated_at = now()
      where id = $1`,
    [
      id,
      input.status,
      input.kind,
      input.sealedType,
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
      input.language,
      input.condition,
      input.grader,
      input.grade,
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

  return valuateWith(items, cards);
}

/** La valorisation elle-même, sur des fiches déjà chargées. Sans réseau. */
export function valuateWith(
  items: Item[],
  cards: Map<string, CardDetail>,
): ValuedItem[] {
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
    } else if (quote && !item.grader) {
      // La cote Cardmarket vaut pour une carte brute. L'appliquer à une carte
      // gradée la sous-évaluerait sans le dire : mieux vaut une ligne non
      // valorisée, qui se voit, qu'un chiffre faux, qui ne se voit pas.
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
      // Investi : tous les prix d'achat, valorisés ou non. Un article dont on
      // ignore la valeur a bien coûté ce qu'il a coûté.
      totalPurchaseCents: summary.totalPurchaseCents + item.totalPurchaseCents,
      totalValueCents: summary.totalValueCents + (item.totalValueCents ?? 0),
      valuedPurchaseCents:
        summary.valuedPurchaseCents +
        (item.totalValueCents === null ? 0 : item.totalPurchaseCents),
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
      valuedPurchaseCents: 0,
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

export type ItemGroup = {
  key: string;
  kind: ItemKind;
  sealedType: SealedType | null;
  name: string;
  setName: string | null;
  image: string | null;
  /** Gradation, état, langue en toutes lettres : voir `editionLabel`. */
  edition: string | null;
  badges: EditionBadges;
  /** Les achats qui composent le groupe, du plus récent au plus ancien. */
  lines: ValuedItem[];
  quantity: number;
  purchaseCents: number;
  /** Prix unitaire moyen, pondéré par les quantités. */
  unitPurchaseCents: number;
  /** `null` si aucune ligne du groupe n'est valorisée. */
  valueCents: number | null;
  gainCents: number | null;
};

function groupKey(item: Item): string {
  const name = item.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  // L'identifiant de carte prime : deux cartes homonymes de sets différents
  // ne sont pas le même produit.
  // La gradation et la langue aussi : une PSA 10 et la même carte brute, ou
  // une japonaise et une française, n'ont ni le même prix ni la même cote.
  const grading = item.grader ? `${item.grader}:${item.grade ?? ""}` : "";
  return `${item.kind}|${item.sealedType ?? ""}|${item.cardId ?? ""}|${item.language ?? "fr"}|${grading}|${name}`;
}

/**
 * Regroupe les achats d'un même produit en une ligne.
 *
 * Les achats individuels sont conservés dans `lines` : deux achats à des dates
 * ou des prix différents restent consultables et modifiables, une moyenne ne
 * doit pas les effacer.
 */
export function groupItems(items: ValuedItem[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();

  for (const item of items) {
    const key = groupKey(item);
    const group = groups.get(key) ?? {
      key,
      kind: item.kind,
      sealedType: item.sealedType,
      name: item.name,
      setName: item.setName,
      image: item.image,
      edition: null,
      badges: { grade: null, language: null, condition: null },
      lines: [],
      quantity: 0,
      purchaseCents: 0,
      unitPurchaseCents: 0,
      valueCents: null,
      gainCents: null,
    };

    group.lines.push(item);
    group.quantity += item.quantity;
    group.purchaseCents += item.totalPurchaseCents;
    group.setName ??= item.setName;
    group.image ??= item.image;

    if (item.totalValueCents !== null) {
      group.valueCents = (group.valueCents ?? 0) + item.totalValueCents;
      group.gainCents = (group.gainCents ?? 0) + (item.gainCents ?? 0);
    }

    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    edition: editionLabel(groupEditionSource(group.lines)),
    badges: editionBadges(groupEditionSource(group.lines)),
    unitPurchaseCents:
      group.quantity === 0
        ? 0
        : Math.round(group.purchaseCents / group.quantity),
  }));
}

/**
 * Langue et gradation sont communes à tout le groupe (elles font partie de sa
 * clé) ; l'état, non. S'il diffère d'un achat à l'autre, on ne l'affiche pas
 * plutôt que d'afficher celui d'un seul exemplaire.
 */
function groupEditionSource(lines: Item[]): Item {
  const conditions = new Set(lines.map((line) => line.condition));
  const first = lines[0];
  return conditions.size === 1 ? first : { ...first, condition: null };
}

/** Le libellé à afficher : le sous-type de scellé s'il existe, sinon le type. */
export function itemLabel(item: {
  kind: ItemKind;
  sealedType: SealedType | null;
}): string {
  return item.sealedType ? SEALED_TYPES[item.sealedType] : KIND_LABELS[item.kind];
}

/**
 * Catégorie d'un article, pour les puces de filtre et de couleur.
 * Le sous-type de scellé s'il existe, sinon le type de l'article.
 */
export type ItemCategory = SealedType | "single" | "other";

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  single: "Cartes",
  booster: "Boosters",
  blister: "Blisters",
  tripack: "Tripacks",
  etb: "ETB",
  display: "Displays",
  coffret: "Coffrets",
  bundle: "Bundles",
  autre: "Autre scellé",
  other: "Autre",
};

/**
 * Ordre fixe. Les couleurs sont attribuées dans cet ordre et ne tournent
 * jamais : une catégorie garde sa teinte quel que soit le filtre actif.
 */
export const CATEGORY_ORDER: ItemCategory[] = [
  "single",
  "booster",
  "blister",
  "tripack",
  "etb",
  "display",
  "coffret",
  "bundle",
  "autre",
  "other",
];

export function itemCategory(item: {
  kind: ItemKind;
  sealedType: SealedType | null;
}): ItemCategory {
  if (item.sealedType) return item.sealedType;
  return item.kind === "single" ? "single" : "other";
}

export function isItemCategory(value: unknown): value is ItemCategory {
  return (
    typeof value === "string" &&
    (CATEGORY_ORDER as string[]).includes(value)
  );
}
