import type { ValuedItem } from "@/lib/collection";
import type { ItemChart } from "@/lib/dashboard";
import type { Point } from "@/lib/history";
import { formatCents, formatSignedPercent, percentChange } from "@/lib/money";

import { Gain } from "../../gain";

/** Marge haute et basse, en pourcentage : la courbe ne touche pas les bords. */
const PAD = 8;

export type ItemChartMode = "cote" | "plus-value";

function dayIndex(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / 86_400_000;
}

function axisEuros(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("fr-FR").replace("-", "−")} €`;
}

function frenchDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Plus-value d'un article et courbe de ses relevés.
 *
 * Deux lectures possibles de la même histoire : la cote face au prix d'achat
 * (l'écart entre les deux lignes est la plus-value), ou la plus-value
 * elle-même, de part et d'autre de zéro.
 */
export function ItemGain({
  item,
  chart,
  mode,
}: {
  item: ValuedItem;
  chart: ItemChart | null;
  mode: ItemChartMode;
}) {
  if (item.gainCents === null || item.totalValueCents === null) {
    return (
      <section className="summary item-gain">
        <div className="summary-main">
          <span className="summary-label">Plus-value</span>
          <span className="summary-value muted">—</span>
          <span className="evolution-note">
            Pas encore de cote : saisissez une valeur actuelle ci-dessous pour
            suivre la plus-value de cet article.
          </span>
        </div>
      </section>
    );
  }

  const change = percentChange(item.totalPurchaseCents, item.totalValueCents);
  const multiple = item.quantity > 1;

  return (
    <section className="summary summary-split item-gain">
      <div className="summary-main">
        <span className="summary-label">Plus-value</span>
        <span className={`summary-value ${item.gainCents >= 0 ? "up" : "down"}`}>
          <Gain cents={item.gainCents} />
        </span>
        {change === undefined ? null : (
          <span className={`pill ${item.gainCents >= 0 ? "up" : "down"}`}>
            {formatSignedPercent(change)}
          </span>
        )}
      </div>

      <div className="summary-aside">
        <div className="summary-item">
          <strong>{formatCents(item.totalPurchaseCents)}</strong>
          <span>
            achat
            {multiple ? ` · ${item.quantity} × ${formatCents(item.purchasePriceCents)}` : ""}
          </span>
        </div>
        <div className="summary-item">
          <strong>{formatCents(item.totalValueCents)}</strong>
          <span>
            {item.valueSource === "market" ? "cote Cardmarket" : "cote saisie"}
            {multiple && item.currentUnitCents !== null
              ? ` · ${item.quantity} × ${formatCents(item.currentUnitCents)}`
              : ""}
          </span>
        </div>
      </div>

      {chart ? <Plot chart={chart} mode={mode} quantity={item.quantity} /> : null}
    </section>
  );
}

function Plot({
  chart,
  mode,
  quantity,
}: {
  chart: ItemChart;
  mode: ItemChartMode;
  quantity: number;
}) {
  const series = mode === "cote" ? chart.value : chart.gain;
  const reference = mode === "cote" ? chart.purchaseCents : 0;

  const all = [...series.map((point) => point.cents), reference];
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    // Une courbe plate a besoin d'une hauteur pour être tracée.
    min -= 1000;
    max += 1000;
  }
  if (mode === "cote") min = Math.max(0, min);

  const span = Math.max(1, dayIndex(chart.end) - dayIndex(chart.start));
  const x = (day: string) =>
    ((dayIndex(day) - dayIndex(chart.start)) / span) * 100;
  const y = (cents: number) =>
    PAD + (1 - (cents - min) / (max - min)) * (100 - 2 * PAD);

  // Marches : une cote vaut jusqu'au relevé suivant, elle ne glisse pas.
  const steps = (points: Point[]) =>
    points
      .map((point, index) =>
        index === 0
          ? `M${x(point.day)},${y(point.cents)}`
          : `H${x(point.day)} V${y(point.cents)}`,
      )
      .join(" ");

  const line = steps(series);
  const first = series[0];
  const last = series[series.length - 1];
  const base = y(reference);
  // L'aire va de la courbe à la référence : au prix d'achat, ou à zéro.
  const area = `${line} V${base} H${x(first.day)} Z`;
  const distinctValues = chart.value.filter(
    (point, index) => index === 0 || point.cents !== chart.value[index - 1].cents,
  ).length;

  const changeCents = chart.gainChange;

  return (
    <div className="evolution">
      <div className="evolution-head">
        <span className="summary-label">
          {mode === "cote" ? "Évolution de la cote" : "Évolution de la plus-value"}
        </span>
        {changeCents !== null && changeCents !== 0 ? (
          <span className={`evolution-change ${changeCents >= 0 ? "up" : "down"}`}>
            <Gain cents={changeCents} />
            {` depuis le ${frenchDay(chart.value[0].day)}`}
          </span>
        ) : null}
      </div>

      <div
        className="evolution-plot item-plot"
        role="img"
        aria-label={`Cote de ${formatCents(first.cents)} à ${formatCents(last.cents)} entre le ${frenchDay(first.day)} et aujourd'hui.`}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="item-holo" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#7cf5ff" />
              <stop offset="0.45" stopColor="#a78bfa" />
              <stop offset="0.75" stopColor="#ffa8e2" />
              <stop offset="1" stopColor="#ffe58a" />
            </linearGradient>
            <linearGradient id="item-fade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#a78bfa" stopOpacity="0.32" />
              <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
            <clipPath id="item-above">
              <rect x="0" y="0" width="100" height={base} />
            </clipPath>
            <clipPath id="item-below">
              <rect x="0" y={base} width="100" height={100 - base} />
            </clipPath>
          </defs>
          <line className="grid" x1="0" x2="100" y1={PAD} y2={PAD} />
          <line className="grid" x1="0" x2="100" y1={100 - PAD} y2={100 - PAD} />

          {mode === "cote" ? (
            <>
              <path className="value-area" d={area} style={{ fill: "url(#item-fade)" }} />
              <line
                className="invested-line"
                x1={x(chart.start)}
                x2="100"
                y1={base}
                y2={base}
              />
              <path className="value-line" d={line} style={{ stroke: "url(#item-holo)" }} />
            </>
          ) : (
            <>
              <path className="gain-area up" d={area} clipPath="url(#item-above)" />
              <path className="gain-area down" d={area} clipPath="url(#item-below)" />
              <line className="invested-line" x1="0" x2="100" y1={base} y2={base} />
              <path className="gain-line up" d={line} clipPath="url(#item-above)" />
              <path className="gain-line down" d={line} clipPath="url(#item-below)" />
            </>
          )}
        </svg>

        <span
          className={`value-dot${mode === "plus-value" ? (last.cents >= 0 ? " up" : " down") : ""}`}
          style={{ left: `${x(last.day)}%`, top: `${y(last.cents)}%` }}
        />

        <span className="axis-label top">{axisEuros(max)}</span>
        <span className="axis-label bottom">{axisEuros(min)}</span>
      </div>

      <div className="evolution-foot">
        <span>{frenchDay(chart.start)}</span>
        <span className="legend">
          {mode === "cote" ? (
            <>
              <span className="key value">Cote</span>
              <span className="key invested">Prix d&apos;achat</span>
            </>
          ) : (
            <>
              <span className="key gain">Plus-value</span>
              <span className="key invested">Zéro</span>
            </>
          )}
        </span>
        <span>aujourd&apos;hui</span>
      </div>

      {distinctValues < 2 ? (
        <p className="evolution-note">
          Une seule cote connue pour l&apos;instant. Chaque nouvelle valeur
          enregistrée, et la cote relevée chaque nuit
          {quantity > 1 ? " pour ces articles" : " pour cet article"}, viendront
          dessiner la courbe.
        </p>
      ) : null}
    </div>
  );
}
