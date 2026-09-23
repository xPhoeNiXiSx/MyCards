import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthConfigured, isAuthenticated } from "@/lib/auth";
import {
  KIND_LABELS,
  groupItems,
  listItems,
  summarize,
  valuate,
  type ItemGroup,
} from "@/lib/collection";
import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";
import { formatCents, formatSignedCents, percentChange } from "@/lib/money";

import { Wordmark } from "../wordmark";
import { DatabaseErrorScreen, SetupScreen } from "../db-screens";
import { TabBar } from "../tab-bar";

import { migrateAction } from "./actions";
import { AddFab } from "./add-fab";

// L'inventaire dépend de la session : jamais de rendu statique ici.
export const dynamic = "force-dynamic";

function Migrate() {
  return (
    <main className="page narrow">
      <h1 className="page-title">Mon inventaire</h1>
      <div className="panel form">
        <h2>Base à initialiser</h2>
        <p className="hint">
          La connexion fonctionne, mais la table de l&apos;inventaire n&apos;existe
          pas encore. Ce bouton l&apos;applique. Il est sans risque et peut être
          rejoué : rien n&apos;est jamais supprimé.
        </p>
        <form action={migrateAction}>
          <button type="submit">Initialiser la base</button>
        </form>
      </div>
      <TabBar />
    </main>
  );
}

/** Date d'achat, en jour/mois/année — la forme qu'on lit dans une liste. */
function fullDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function GroupValue({ group }: { group: ItemGroup }) {
  if (group.valueCents === null) {
    return (
      <span
        className="muted"
        title={
          group.lines.some((line) => line.cardId)
            ? "Pas encore cotée sur Cardmarket. Saisis une valeur pour la valoriser."
            : "Aucune valeur saisie pour cet article."
        }
      >
        —
      </span>
    );
  }

  // Une seule origine possible quand toutes les lignes s'accordent ; sinon on
  // ne prétend pas d'où vient le chiffre.
  const sources = new Set(
    group.lines
      .filter((line) => line.totalValueCents !== null)
      .map((line) => line.valueSource),
  );
  const source = sources.size === 1 ? [...sources][0] : null;

  const day =
    group.lines.length === 1
      ? shortDate(
          group.lines[0].valueSource === "manual"
            ? group.lines[0].manualValueDate
            : group.lines[0].quoteUpdated,
        )
      : null;

  return (
    <span>
      {formatCents(group.valueCents)}
      {source ? (
        <em className="source">
          {source === "manual" ? "saisie" : "cote"}
          {day ? ` ${day}` : ""}
        </em>
      ) : null}
    </span>
  );
}

export default async function CollectionPage() {
  const missing: string[] = [];
  if (!isAuthConfigured()) missing.push("APP_PASSWORD", "AUTH_SECRET");
  if (!isDatabaseConfigured()) missing.push("DATABASE_URL");
  if (missing.length > 0)
    return <SetupScreen title="Mon inventaire" missing={missing} />;

  if (!(await isAuthenticated())) redirect("/login?next=/collection");

  try {
    if (!(await isSchemaReady())) return <Migrate />;
  } catch (error) {
    return (
      <DatabaseErrorScreen
        title="Mon inventaire"
        message={
          error instanceof Error ? error.message : "Erreur de connexion inconnue."
        }
      />
    );
  }

  let items;
  try {
    items = await valuate(await listItems());
  } catch (error) {
    // Typiquement une colonne ajoutée par une mise à jour et pas encore
    // appliquée : le message doit dire quoi faire, pas seulement ce qui casse.
    return (
      <DatabaseErrorScreen
        title="Mon inventaire"
        message={
          error instanceof Error ? error.message : "Erreur de lecture inconnue."
        }
      />
    );
  }

  const summary = summarize(items);
  const groups = groupItems(items);
  // Comparé au prix d'achat des seules lignes valorisées : rapporter une
  // valeur partielle à l'investissement total donnerait un pourcentage faux.
  const change = percentChange(
    summary.valuedPurchaseCents,
    summary.totalValueCents,
  );

  return (
    <main className="page">
      <header className="masthead">
        <div className="wordmark">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
      </header>

      <h1 className="page-title">Mon inventaire</h1>

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
              article{summary.unitCount > 1 ? "s" : ""}
              {summary.unvaluedCount > 0
                ? `, ${summary.unvaluedCount} sans cote`
                : ""}
              {summary.withoutPriceCount > 0
                ? `, ${summary.withoutPriceCount} sans prix`
                : ""}
            </span>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="panel">
          <h2>Inventaire vide</h2>
          <p className="hint">
            Ajoute ton premier article avec le bouton <strong>+</strong>, en bas
            à droite de l&apos;écran.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th className="num">Qté</th>
                <th className="num">Prix unitaire</th>
                <th className="num">Achat</th>
                <th className="num">Valeur</th>
                <th className="num">Plus-value</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.key}>
                  <td className="title-cell">
                    <div className="title-row">
                      {group.image ? (
                        <img className="thumb" src={group.image} alt="" />
                      ) : (
                        <span className="thumb empty" aria-hidden="true" />
                      )}
                      <div className="title-text">
                        {group.lines.length === 1 ? (
                          <Link href={`/collection/${group.lines[0].id}`}>
                            {group.name}
                          </Link>
                        ) : (
                          <span className="group-name">{group.name}</span>
                        )}
                        <span className="muted block">
                          {[KIND_LABELS[group.kind], group.setName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {/* Plusieurs achats du même produit : chacun reste
                            atteignable, une moyenne ne doit pas les effacer. */}
                        {group.lines.length > 1 ? (
                          <span className="purchases">
                            {group.lines.map((line) => (
                              <Link
                                key={line.id}
                                href={`/collection/${line.id}`}
                                title={`Modifier cet achat`}
                              >
                                {line.quantity} × {formatCents(line.purchasePriceCents)}
                                {fullDate(line.purchaseDate)
                                  ? ` le ${fullDate(line.purchaseDate)}`
                                  : ""}
                              </Link>
                            ))}
                          </span>
                        ) : fullDate(group.lines[0].purchaseDate) ? (
                          <span className="muted block">
                            acheté le {fullDate(group.lines[0].purchaseDate)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="num" data-label="Quantité">
                    {group.quantity}
                  </td>

                  <td className="num" data-label="Prix unitaire">
                    <span>
                      {formatCents(group.unitPurchaseCents)}
                      {group.lines.length > 1 ? (
                        <em className="source">moyen</em>
                      ) : null}
                    </span>
                  </td>

                  <td className="num" data-label="Achat">
                    {formatCents(group.purchaseCents)}
                  </td>

                  <td className="num" data-label="Valeur">
                    <GroupValue group={group} />
                  </td>

                  <td
                    className={`num ${
                      group.gainCents === null
                        ? "muted"
                        : group.gainCents >= 0
                          ? "up"
                          : "down"
                    }`}
                    data-label="Plus-value"
                  >
                    {group.gainCents === null
                      ? "—"
                      : formatSignedCents(group.gainCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddFab />

      <TabBar />
    </main>
  );
}
