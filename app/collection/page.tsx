import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthConfigured, isAuthenticated } from "@/lib/auth";
import {
  KIND_LABELS,
  listItems,
  summarize,
  valuate,
  type ValuedItem,
} from "@/lib/collection";
import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";
import { formatCents, formatSignedCents, percentChange } from "@/lib/money";

import { Wordmark } from "../wordmark";
import { TabBar } from "../tab-bar";

import { addItemAction, migrateAction } from "./actions";
import { ItemForm } from "./item-form";

// L'inventaire dépend de la session : jamais de rendu statique ici.
export const dynamic = "force-dynamic";

function Setup({ missing }: { missing: string[] }) {
  return (
    <main className="page narrow">
      <h1 className="page-title">Mon inventaire</h1>
      <div className="panel">
        <h2>Configuration incomplète</h2>
        <p className="hint">
          Il manque {missing.length > 1 ? "ces variables" : "cette variable"}{" "}
          d&apos;environnement côté Vercel :
        </p>
        <ul className="hint">
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="hint">
          Settings → Environment Variables, puis redéploie. Le détail est dans
          le README.
        </p>
      </div>
      <TabBar />
    </main>
  );
}

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

function DatabaseError({ message }: { message: string }) {
  return (
    <main className="page narrow">
      <h1 className="page-title">Mon inventaire</h1>
      <div className="panel">
        <h2>Base injoignable</h2>
        <p className="hint">{message}</p>
        <p className="hint">
          Si le message parle d&apos;une colonne inconnue, une migration reste à
          appliquer : ouvre <strong>Mon compte</strong> et lance{" "}
          <strong>Appliquer les migrations</strong>. Sinon, vérifie{" "}
          <code>DATABASE_URL</code> dans les variables d&apos;environnement
          Vercel, puis redéploie.
        </p>
      </div>
      <TabBar />
    </main>
  );
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function ValueCell({ item }: { item: ValuedItem }) {
  if (item.totalValueCents === null) {
    return (
      <span
        className="muted"
        title={
          item.cardId
            ? "Cette carte n'est pas encore cotée sur Cardmarket. Saisis une valeur pour la valoriser."
            : "Aucune valeur saisie pour cet article."
        }
      >
        —
      </span>
    );
  }

  const day = shortDate(
    item.valueSource === "manual" ? item.manualValueDate : item.quoteUpdated,
  );

  const label =
    item.valueSource === "manual"
      ? `Valeur saisie${item.manualValueDate ? ` le ${item.manualValueDate}` : ""}`
      : `Cote Cardmarket (${item.quoteField})`;

  return (
    <span title={label}>
      {formatCents(item.totalValueCents)}
      <em className="source">
        {item.valueSource === "manual" ? "saisie" : "cote"}
        {day ? ` ${day}` : ""}
      </em>
    </span>
  );
}

export default async function CollectionPage() {
  const missing: string[] = [];
  if (!isAuthConfigured()) missing.push("APP_PASSWORD", "AUTH_SECRET");
  if (!isDatabaseConfigured()) missing.push("DATABASE_URL");
  if (missing.length > 0) return <Setup missing={missing} />;

  if (!(await isAuthenticated())) redirect("/login?next=/collection");

  try {
    if (!(await isSchemaReady())) return <Migrate />;
  } catch (error) {
    return (
      <DatabaseError
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
      <DatabaseError
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
            </span>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="panel">
          <h2>Inventaire vide</h2>
          <p className="hint">
            Ajoute ton premier article avec le bouton ci-dessous.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th className="num">Qté</th>
                <th className="num">Achat</th>
                <th className="num">Valeur</th>
                <th className="num">Plus-value</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="title-cell">
                    <div className="title-row">
                      {item.image ? (
                        <img className="thumb" src={item.image} alt="" />
                      ) : (
                        <span className="thumb empty" aria-hidden="true" />
                      )}
                      <div className="title-text">
                        <Link href={`/collection/${item.id}`}>{item.name}</Link>
                        <span className="muted block">
                          {KIND_LABELS[item.kind]}
                          {item.setName ? ` · ${item.setName}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="num" data-label="Quantité">
                    {item.quantity}
                  </td>
                  <td className="num" data-label="Achat">
                    {formatCents(item.totalPurchaseCents)}
                  </td>
                  <td className="num" data-label="Valeur">
                    <ValueCell item={item} />
                  </td>
                  <td
                    className={`num ${
                      item.gainCents === null
                        ? "muted"
                        : item.gainCents >= 0
                          ? "up"
                          : "down"
                    }`}
                    data-label="Plus-value"
                  >
                    {item.gainCents === null
                      ? "—"
                      : formatSignedCents(item.gainCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="panel disclosure" open={items.length === 0}>
        <summary>
          <span>Ajouter un article</span>
        </summary>
        <ItemForm action={addItemAction} submitLabel="Ajouter" />
      </details>

      <TabBar />
    </main>
  );
}
