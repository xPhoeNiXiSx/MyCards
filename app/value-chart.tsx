import Link from "next/link";

import { PERIODS, type Chart, type Period } from "@/lib/dashboard";
import type { Point } from "@/lib/history";
import { formatCents, formatSignedCents } from "@/lib/money";

/** Marge haute et basse, en pourcentage : la courbe ne touche pas les bords. */
const PAD = 8;

function dayIndex(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / 86_400_000;
}

/** Repère d'axe : à l'euro près, les centimes n'y apprennent rien. */
function axisEuros(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("fr-FR")} €`;
}

function frenchDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Évolution de l'inventaire : la valeur relevée chaque jour, et l'investi.
 *
 * Le tracé est en SVG étiré (`preserveAspectRatio="none"`) pour épouser la
 * largeur disponible ; les libellés et le point final sont en HTML
 * par-dessus, sans quoi l'étirement les déformerait.
 */
export function ValueChart({
  chart,
  period,
}: {
  chart: Chart;
  period: Period;
}) {
  const span = Math.max(1, dayIndex(chart.end) - dayIndex(chart.start));
  const x = (day: string) => ((dayIndex(day) - dayIndex(chart.start)) / span) * 100;
  const y = (cents: number) =>
    PAD + (1 - (cents - chart.min) / (chart.max - chart.min)) * (100 - 2 * PAD);

  const line = (points: Point[]) =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.day)},${y(point.cents)}`)
      .join(" ");

  // Marches : l'investi reste plat entre deux achats, il ne glisse pas.
  const steps = chart.invested
    .map((point, index) =>
      index === 0
        ? `M${x(point.day)},${y(point.cents)}`
        : `H${x(point.day)} V${y(point.cents)}`,
    )
    .join(" ");

  const value = chart.value;
  const last = value.at(-1);
  const area =
    value.length >= 2
      ? `${line(value)} L${x(value[value.length - 1].day)},100 L${x(value[0].day)},100 Z`
      : null;

  return (
    <div className="evolution">
      <div className="evolution-head">
        <span className="summary-label">Évolution</span>
        {chart.valueChange !== null ? (
          <span className={`evolution-change ${chart.valueChange >= 0 ? "up" : "down"}`}>
            {formatSignedCents(chart.valueChange)}
            {/* L'écart porte sur les relevés : en « Tout », il part du
                premier relevé, pas du premier achat. */}
            {period === "tout"
              ? ` depuis le ${frenchDay(value[0].day)}`
              : ` sur ${PERIODS.find((entry) => entry.key === period)?.days} jours`}
          </span>
        ) : null}
        <nav className="range" aria-label="Période">
          {PERIODS.map((entry) => (
            <Link
              key={entry.key}
              href={entry.key === "30j" ? "/" : `/?periode=${entry.key}`}
              className="chip"
              aria-pressed={entry.key === period}
              scroll={false}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>

      <div
        className="evolution-plot"
        role="img"
        aria-label={`Évolution du ${frenchDay(chart.start)} à aujourd'hui : investi ${formatCents(chart.invested.at(-1)?.cents ?? 0)}${last ? `, valeur ${formatCents(last.cents)}` : ""}.`}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="grid" x1="0" x2="100" y1={PAD} y2={PAD} />
          <line className="grid" x1="0" x2="100" y1={100 - PAD} y2={100 - PAD} />
          {area ? <path className="value-area" d={area} /> : null}
          {steps ? <path className="invested-line" d={steps} /> : null}
          {value.length >= 2 ? <path className="value-line" d={line(value)} /> : null}
        </svg>

        {last ? (
          <span
            className="value-dot"
            style={{ left: `${x(last.day)}%`, top: `${y(last.cents)}%` }}
          />
        ) : null}

        <span className="axis-label top">{axisEuros(chart.max)}</span>
        <span className="axis-label bottom">{axisEuros(chart.min)}</span>
      </div>

      <div className="evolution-foot">
        <span>{frenchDay(chart.start)}</span>
        <span className="legend">
          <span className="key value">Valeur</span>
          <span className="key invested">Investi</span>
        </span>
        <span>aujourd&apos;hui</span>
      </div>

      {value.length < 2 ? (
        <p className="evolution-note">
          La valeur est relevée chaque jour depuis le{" "}
          {frenchDay(value[0]?.day ?? chart.end)} : sa courbe se dessinera au
          fil des jours. L&apos;investi, lui, remonte jusqu&apos;au premier
          achat.
        </p>
      ) : null}
    </div>
  );
}
