import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthConfigured, isAuthenticated } from "@/lib/auth";
import {
  KIND_LABELS,
  bestGain,
  breakdown,
  listItems,
  summarize,
  valuate,
} from "@/lib/collection";
import { isDatabaseConfigured } from "@/lib/db";
import { formatCents, formatSignedCents, percentChange } from "@/lib/money";

import { DatabaseErrorScreen, SetupScreen } from "./db-screens";
import { TabBar } from "./tab-bar";
import { Wordmark } from "./wordmark";

// Le tableau de bord lit la base : jamais de rendu statique.
export const dynamic = "force-dynamic";

const TITLE = "Tableau de bord";

export default async function DashboardPage() {
  const missing: string[] = [];
  if (!isAuthConfigured()) missing.push("APP_PASSWORD", "AUTH_SECRET");
  if (!isDatabaseConfigured()) missing.push("DATABASE_URL");
  if (missing.length > 0) return <SetupScreen title={TITLE} missing={missing} />;

  // Le proxy redirige déjà, mais une page qui lit la base ne s'en remet pas
  // à une couche au-dessus d'elle pour savoir qui la consulte.
  if (!(await isAuthenticated())) redirect("/login?next=/");

  let items;
  try {
    items = await valuate(await listItems());
  } catch (error) {
    return (
      <DatabaseErrorScreen
        title={TITLE}
        message={
          error instanceof Error ? error.message : "Erreur de lecture inconnue."
        }
      />
    );
  }

  const summary = summarize(items);
  const change = percentChange(
    summary.totalPurchaseCents,
    summary.totalValueCents,
  );
  const parts = breakdown(items);
  const best = bestGain(items);
  // `listItems` trie du plus récent au plus ancien : la tête est le dernier ajout.
  const latest = items[0];

  return (
    <main className="page">
      <header className="masthead">
        <div className="wordmark">
          <Wordmark />
        </div>
      </header>

      <h1 className="page-title">{TITLE}</h1>

      {items.length === 0 ? (
        <div className="panel">
          <h2>Collection vide</h2>
          <p className="hint">
            Rien à résumer pour l&apos;instant. Ajoute ton premier article et ce
            tableau de bord se remplira.
          </p>
          <p className="hint">
            <Link href="/collection">Ouvrir l&apos;inventaire →</Link>
          </p>
        </div>
      ) : (
        <>
          <section className="summary">
            <div className="summary-main">
              <span className="summary-label">Valeur actuelle</span>
              <span className="summary-value">
                {formatCents(summary.totalValueCents)}
              </span>
              <span className={`pill ${summary.gainCents >= 0 ? "up" : "down"}`}>
                {formatSignedCents(summary.gainCents)}
                {change === undefined ? null : (
                  <small>
                    {change > 0 ? "+" : ""}
                    {change} %
                  </small>
                )}
              </span>
            </div>

            <div className="summary-aside">
              <div className="summary-item">
                <strong>{formatCents(summary.totalPurchaseCents)}</strong>
                <span>investi</span>
              </div>
              <div className="summary-item">
                <strong>{summary.unitCount}</strong>
                <span>
                  article{summary.unitCount > 1 ? "s" : ""} possédé
                  {summary.unitCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </section>

          <section className="kpis">
            <div className="kpi">
              <span className="kpi-label">Lignes d&apos;inventaire</span>
              <strong>{summary.itemCount}</strong>
              <span className="kpi-note">
                {summary.unvaluedCount > 0
                  ? `${summary.unvaluedCount} sans cote`
                  : "toutes valorisées"}
              </span>
            </div>

            <div className="kpi">
              <span className="kpi-label">Meilleure plus-value</span>
              <strong className={(best?.gainCents ?? 0) >= 0 ? "up" : "down"}>
                {best ? formatSignedCents(best.gainCents ?? 0) : "—"}
              </strong>
              <span className="kpi-note">{best ? best.name : "aucune cote"}</span>
            </div>

            <div className="kpi">
              <span className="kpi-label">Sans prix d&apos;achat</span>
              <strong className={summary.withoutPriceCount > 0 ? "down" : ""}>
                {summary.withoutPriceCount}
              </strong>
              <span className="kpi-note">
                {summary.withoutPriceCount > 0
                  ? "comptées 0 € dans l'investi"
                  : "tout est renseigné"}
              </span>
            </div>

            <div className="kpi">
              <span className="kpi-label">Mise moyenne</span>
              <strong>
                {formatCents(
                  Math.round(summary.totalPurchaseCents / summary.unitCount),
                )}
              </strong>
              <span className="kpi-note">par article</span>
            </div>

            <div className="kpi">
              <span className="kpi-label">Dernier ajout</span>
              <strong className="kpi-text">{latest.name}</strong>
              <span className="kpi-note">{KIND_LABELS[latest.kind]}</span>
            </div>
          </section>

          <h2 className="section-title">Répartition par type</h2>
          <div className="panel breakdown">
            {parts.map((part) => (
              <div className="breakdown-row" key={part.kind}>
                <div className="breakdown-head">
                  <span className="breakdown-name">{KIND_LABELS[part.kind]}</span>
                  <span className="breakdown-value">
                    {formatCents(part.valueCents)}
                    <em>{part.share} %</em>
                  </span>
                </div>
                {/* Barre à libellé direct : la valeur est écrite au-dessus,
                    donc pas de légende ni d'infobulle à deviner. */}
                <div
                  className="breakdown-bar"
                  role="img"
                  aria-label={`${part.share} % de la valeur totale`}
                >
                  <span style={{ width: `${part.share}%` }} />
                </div>
                <span className="breakdown-note">
                  {part.units} article{part.units > 1 ? "s" : ""} ·{" "}
                  {formatCents(part.purchaseCents)} investi
                </span>
              </div>
            ))}
          </div>

        </>
      )}

      <TabBar />
    </main>
  );
}
