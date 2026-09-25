import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthConfigured, isAuthenticated } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  SCOPES,
  bestGain,
  inScope,
  groupItems,
  itemLabel,
  listItems,
  summarize,
  valuate,
} from "@/lib/collection";
import {
  buildChart,
  categoryBreakdown,
  isPeriod,
  matchesCheck,
  movers,
  pendingChecks,
  type Chart,
} from "@/lib/dashboard";
import { isDatabaseConfigured } from "@/lib/db";
import {
  investedSeries,
  parisToday,
  recordSnapshot,
  valueSeries,
} from "@/lib/history";
import { formatCents, percentChange } from "@/lib/money";

import { DatabaseErrorScreen, SetupScreen } from "./db-screens";
import { Gain } from "./gain";
import { TabBar } from "./tab-bar";
import { ValueChart } from "./value-chart";
import { Wordmark } from "./wordmark";

// Le tableau de bord lit la base : jamais de rendu statique.
export const dynamic = "force-dynamic";

const TITLE = "Tableau de bord";

/** Vignette d'article : son visuel, ou un emplacement vide de même taille. */
function Thumb({ src, className = "thumb" }: { src: string | null; className?: string }) {
  return src ? (
    <img className={className} src={src} alt="" loading="lazy" />
  ) : (
    <span className={`${className} empty`} aria-hidden="true" />
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  const period = isPeriod(periode) ? periode : "30j";

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
  // Comparé au prix d'achat des seules lignes valorisées : rapporter une
  // valeur partielle à l'investissement total donnerait un pourcentage faux.
  const change = percentChange(
    summary.valuedPurchaseCents,
    summary.totalValueCents,
  );
  const today = parisToday();
  const groups = groupItems(items);
  const shares = categoryBreakdown(items);
  const moves = movers(groups);
  const checks = pendingChecks(items, today);
  const best = bestGain(items);
  // `listItems` trie du plus récent au plus ancien : la tête est le dernier ajout.
  const latest = items[0];

  // Chaque affichage relève la valeur du jour ; le cron couvre les jours sans
  // visite. Un échec (schéma pas encore migré, typiquement) ne doit jamais
  // empêcher d'afficher le tableau de bord : la courbe manquera, rien d'autre.
  let chart: Chart | null = null;
  if (items.length > 0) {
    try {
      await recordSnapshot(summary);
      chart = buildChart(
        await investedSeries(),
        await valueSeries(),
        period,
        today,
      );
    } catch (error) {
      console.warn("[dashboard] historique indisponible", error);
    }
  }

  return (
    <main className="page">
      {/* Page de garde : la marque en grand, à la place de l'en-tête et du
          titre. Le titre reste annoncé aux lecteurs d'écran. */}
      <header className="cover">
        <Wordmark className="cover-logo" />
      </header>
      <h1 className="sr-only">{TITLE}</h1>

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
          <section className="summary summary-split">
            <div className="summary-main">
              <span className="summary-label">Valeur actuelle</span>
              <span className="summary-value">
                {formatCents(summary.totalValueCents)}
              </span>
              <span className={`pill ${summary.gainCents >= 0 ? "up" : "down"}`}>
                <Gain cents={summary.gainCents} />
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

            {chart ? <ValueChart chart={chart} period={period} /> : null}
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

            {best ? (
              <Link className="kpi kpi-link" href={`/collection/${best.id}`}>
                <span className="kpi-label">Meilleure plus-value</span>
                <span className="kpi-thumb">
                  <Thumb src={best.image} />
                  <span>
                    <strong className={(best.gainCents ?? 0) >= 0 ? "up" : "down"}>
                      <Gain cents={best.gainCents ?? 0} />
                    </strong>
                    <span className="kpi-note">{best.name}</span>
                  </span>
                </span>
              </Link>
            ) : (
              <div className="kpi">
                <span className="kpi-label">Meilleure plus-value</span>
                <strong>—</strong>
                <span className="kpi-note">aucune cote</span>
              </div>
            )}

            <div className="kpi">
              <span className="kpi-label">Mise moyenne</span>
              <strong>
                {formatCents(
                  Math.round(summary.totalPurchaseCents / summary.unitCount),
                )}
              </strong>
              <span className="kpi-note">par article</span>
            </div>

            <Link className="kpi kpi-link" href={`/collection/${latest.id}`}>
              <span className="kpi-label">Dernier ajout</span>
              <span className="kpi-thumb">
                <Thumb src={latest.image} />
                <span>
                  <strong className="kpi-text">{latest.name}</strong>
                  <span className="kpi-note">{itemLabel(latest)}</span>
                </span>
              </span>
            </Link>
          </section>

          {/* Rien à vérifier, rien à afficher : un bloc vide ne ferait que
              pousser le reste plus bas. */}
          {checks.length > 0 ? (
            <>
              <h2 className="section-title">À vérifier</h2>
              <div className="checks">
                {checks.map((check) => (
                  <Link
                    key={check.key}
                    className="check"
                    // Vers les cartes s'il y en a de concernées, sinon vers le
                    // scellé : la page d'arrivée signale l'autre au besoin.
                    href={`${
                      items.some(
                        (item) =>
                          inScope(item, "cards") &&
                          matchesCheck(item, check.key, today),
                      )
                        ? SCOPES.cards.path
                        : SCOPES.sealed.path
                    }?verifier=${check.key}`}
                  >
                    <span className="check-count">{check.count}</span>
                    <span>{check.label}</span>
                    <span className="check-go" aria-hidden="true">
                      Voir →
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}

          {moves.gains.length > 0 || moves.losses.length > 0 ? (
            <>
              <h2 className="section-title">Hausses et baisses</h2>
              <div className="panel movers">
                {[
                  { title: "Plus-values", list: moves.gains, empty: "Aucune pour l'instant." },
                  { title: "Moins-values", list: moves.losses, empty: "Aucune, tout est au-dessus du prix d'achat." },
                ].map((column) => (
                  <div key={column.title} className="movers-col">
                    <h3 className="movers-title">{column.title}</h3>
                    {column.list.length === 0 ? (
                      <p className="hint">{column.empty}</p>
                    ) : (
                      <div className="movers-list">
                      {column.list.map((group) => (
                        <Link
                          key={group.key}
                          className="mover"
                          href={`/collection/${group.lines[0].id}`}
                        >
                          <Thumb src={group.image} />
                          <span className="mover-text">
                            <span className="mover-name">
                              {group.name}
                              {group.quantity > 1 ? ` ×${group.quantity}` : ""}
                            </span>
                            <span
                              className={`mover-gain ${(group.gainCents ?? 0) >= 0 ? "up" : "down"}`}
                            >
                              <Gain cents={group.gainCents ?? 0} />
                            </span>
                          </span>
                        </Link>
                      ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h2 className="section-title">Répartition par catégorie</h2>
          <div className="panel breakdown">
            {shares.map((part) => (
              <div className="breakdown-row" key={part.category}>
                <div className="breakdown-head">
                  <span className="breakdown-name">
                    <span
                      className="cat-mark"
                      aria-hidden="true"
                      style={{ ["--dot" as string]: `var(--cat-${part.category})` }}
                    />
                    {CATEGORY_LABELS[part.category]}
                  </span>
                  <span className="breakdown-value">
                    {formatCents(part.valueCents)}
                    <em>{part.share} %</em>
                  </span>
                </div>
                {/* Barre à libellé direct : la valeur est écrite au-dessus,
                    donc pas de légende ni d'infobulle à deviner. La couleur
                    reprend celle de la catégorie dans l'inventaire. */}
                <div
                  className="breakdown-bar"
                  role="img"
                  aria-label={`${part.share} % de la valeur totale`}
                >
                  <span
                    style={{
                      width: `${part.share}%`,
                      background: `var(--cat-${part.category})`,
                    }}
                  />
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
