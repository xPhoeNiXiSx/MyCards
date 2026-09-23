/**
 * Calculs du tableau de bord. Fonctions pures, sans base ni réseau : elles
 * travaillent sur l'inventaire déjà valorisé et se testent telles quelles.
 */

import {
  CATEGORY_ORDER,
  itemCategory,
  type ItemCategory,
  type ItemGroup,
  type ValuedItem,
} from "@/lib/collection";
import type { Point } from "@/lib/history";

// --- À vérifier ----------------------------------------------------------

/** Au-delà, une cote saisie à la main a toutes les chances d'être dépassée. */
export const STALE_DAYS = 90;

export type CheckKey = "sans-cote" | "cote-ancienne" | "gradee" | "sans-prix";

export const CHECKS: { key: CheckKey; label: string }[] = [
  { key: "sans-cote", label: "Sans cote : non comptés dans la valeur" },
  { key: "gradee", label: "Carte gradée sans valeur saisie" },
  { key: "cote-ancienne", label: `Cote saisie il y a plus de ${STALE_DAYS / 30} mois` },
  { key: "sans-prix", label: "Sans prix d'achat : comptés 0 € dans l'investi" },
];

export function isCheckKey(value: unknown): value is CheckKey {
  return CHECKS.some((check) => check.key === value);
}

/** Jours écoulés entre deux dates AAAA-MM-JJ. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

export function matchesCheck(
  item: ValuedItem,
  key: CheckKey,
  today: string,
): boolean {
  switch (key) {
    case "sans-cote":
      return item.totalValueCents === null;
    case "gradee":
      // Sous-ensemble de « sans cote », signalé à part : la cause est connue
      // et le remède n'est pas le même (saisir une valeur, pas attendre une
      // cote qui ne viendra jamais).
      return item.grader !== null && item.manualValueCents === null;
    case "cote-ancienne":
      return (
        item.valueSource === "manual" &&
        item.manualValueDate !== null &&
        daysBetween(item.manualValueDate, today) > STALE_DAYS
      );
    case "sans-prix":
      return item.purchasePriceCents === 0;
  }
}

/** Les vérifications qui concernent au moins une ligne, avec leur compte. */
export function pendingChecks(
  items: ValuedItem[],
  today: string,
): { key: CheckKey; label: string; count: number }[] {
  return CHECKS.map((check) => ({
    ...check,
    count: items.filter((item) => matchesCheck(item, check.key, today)).length,
  })).filter((check) => check.count > 0);
}

// --- Répartition par catégorie -------------------------------------------

export type CategoryShare = {
  category: ItemCategory;
  units: number;
  purchaseCents: number;
  /** Ne totalise que les lignes valorisées. */
  valueCents: number;
  /** Part de la valeur totale, en pourcentage entier. */
  share: number;
};

/**
 * Comme la répartition par type, mais au grain des puces de l'inventaire :
 * « Scellé » seul mélange un booster et un display.
 */
export function categoryBreakdown(items: ValuedItem[]): CategoryShare[] {
  const rows = new Map<ItemCategory, CategoryShare>();

  for (const item of items) {
    const category = itemCategory(item);
    const row = rows.get(category) ?? {
      category,
      units: 0,
      purchaseCents: 0,
      valueCents: 0,
      share: 0,
    };
    row.units += item.quantity;
    row.purchaseCents += item.totalPurchaseCents;
    row.valueCents += item.totalValueCents ?? 0;
    rows.set(category, row);
  }

  const total = [...rows.values()].reduce((sum, row) => sum + row.valueCents, 0);

  return [...rows.values()]
    .map((row) => ({
      ...row,
      share: total === 0 ? 0 : Math.round((row.valueCents / total) * 100),
    }))
    .sort(
      (a, b) =>
        b.valueCents - a.valueCents ||
        // À valeur égale (souvent zéro), l'ordre fixe des catégories.
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );
}

// --- Hausses et baisses --------------------------------------------------

export const MOVERS = 3;

/**
 * Les plus fortes plus-values et moins-values, par produit (comme
 * l'inventaire les regroupe). Un produit sans cote n'apparaît dans aucune
 * des deux listes, et un gain nul n'est ni une hausse ni une baisse.
 */
export function movers(groups: ItemGroup[]): {
  gains: ItemGroup[];
  losses: ItemGroup[];
} {
  const valued = groups.filter((group) => group.gainCents !== null);
  return {
    gains: valued
      .filter((group) => (group.gainCents ?? 0) > 0)
      .sort((a, b) => (b.gainCents ?? 0) - (a.gainCents ?? 0))
      .slice(0, MOVERS),
    losses: valued
      .filter((group) => (group.gainCents ?? 0) < 0)
      .sort((a, b) => (a.gainCents ?? 0) - (b.gainCents ?? 0))
      .slice(0, MOVERS),
  };
}

// --- Courbe --------------------------------------------------------------

export type Period = "7j" | "30j" | "tout";

export const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "7j", label: "7 j", days: 7 },
  { key: "30j", label: "30 j", days: 30 },
  { key: "tout", label: "Tout", days: null },
];

export function isPeriod(value: unknown): value is Period {
  return PERIODS.some((period) => period.key === value);
}

function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export type Chart = {
  start: string;
  end: string;
  /** Marches d'escalier : l'investi ne bouge qu'aux jours d'achat. */
  invested: Point[];
  value: Point[];
  min: number;
  max: number;
  /** Écart de valeur sur la période, s'il y a au moins deux relevés. */
  valueChange: number | null;
};

/**
 * Découpe les deux séries sur la période demandée.
 *
 * L'investi part de son niveau au premier jour de la période (ce qui a été
 * acheté avant compte) et se prolonge jusqu'à aujourd'hui. La valeur ne
 * garde que les relevés de la période : rien n'est inventé entre deux.
 */
export function buildChart(
  invested: Point[],
  value: Point[],
  period: Period,
  today: string,
): Chart {
  const days = PERIODS.find((entry) => entry.key === period)?.days ?? null;
  const first = [invested[0]?.day, value[0]?.day]
    .filter((day): day is string => Boolean(day))
    .sort()[0];
  const start =
    days === null ? (first ?? today) : addDays(today, -(days - 1));

  const before = invested.filter((point) => point.day < start).at(-1);
  const inside = invested.filter(
    (point) => point.day >= start && point.day <= today,
  );
  const level = inside.at(-1)?.cents ?? before?.cents ?? 0;
  const steps: Point[] =
    invested.length === 0
      ? []
      : [
          ...(inside[0]?.day === start
            ? []
            : [{ day: start, cents: before?.cents ?? 0 }]),
          ...inside,
          ...(inside.at(-1)?.day === today ? [] : [{ day: today, cents: level }]),
        ];

  const shown = value.filter((point) => point.day >= start && point.day <= today);
  const all = [...steps, ...shown].map((point) => point.cents);
  let min = all.length > 0 ? Math.min(...all) : 0;
  let max = all.length > 0 ? Math.max(...all) : 0;
  if (min === max) {
    // Une courbe plate a besoin d'une hauteur pour être tracée.
    min = Math.max(0, min - 1000);
    max = max + 1000;
  }

  return {
    start,
    end: today,
    invested: steps,
    value: shown,
    min,
    max,
    valueChange:
      shown.length >= 2 ? shown[shown.length - 1].cents - shown[0].cents : null,
  };
}
