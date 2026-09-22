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

import { addItemAction, deleteItemAction, migrateAction } from "./actions";
import { ItemForm } from "./item-form";

// L'inventaire dépend de la session : jamais de rendu statique ici.
export const dynamic = "force-dynamic";

function Setup({ missing }: { missing: string[] }) {
  return (
    <main className="page narrow">
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
    </main>
  );
}

function Migrate() {
  return (
    <main className="page narrow">
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
    </main>
  );
}

function DatabaseError({ message }: { message: string }) {
  return (
    <main className="page narrow">
      <div className="panel">
        <h2>Base injoignable</h2>
        <p className="hint">{message}</p>
        <p className="hint">
          Vérifie <code>DATABASE_URL</code> dans les variables
          d&apos;environnement Vercel, puis redéploie.
        </p>
      </div>
    </main>
  );
}

function ValueCell({ item }: { item: ValuedItem }) {
  if (item.totalValueCents === null) {
    return (
      <span className="muted" title="Aucune cote connue pour cet article">
        —
      </span>
    );
  }

  const label =
    item.valueSource === "manual"
      ? `Valeur saisie${item.manualValueDate ? ` le ${item.manualValueDate}` : ""}`
      : `Cote Cardmarket (${item.quoteField})`;

  return (
    <span title={label}>
      {formatCents(item.totalValueCents)}
      <em className="source">{item.valueSource === "manual" ? "saisie" : "cote"}</em>
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

  const items = await valuate(await listItems());
  const summary = summarize(items);
  const change = percentChange(
    summary.totalPurchaseCents,
    summary.totalValueCents,
  );

  return (
    <main className="page">
      <header className="masthead">
        <h1 className="wordmark">
          <Link href="/">
            My<span>Cards</span>
          </Link>
        </h1>
        <p>Inventaire — {summary.itemCount} ligne{summary.itemCount > 1 ? "s" : ""}</p>
      </header>

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">Investi</span>
          <strong>{formatCents(summary.totalPurchaseCents)}</strong>
          <span className="muted">{summary.unitCount} article{summary.unitCount > 1 ? "s" : ""}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Valeur actuelle</span>
          <strong>{formatCents(summary.totalValueCents)}</strong>
          {summary.unvaluedCount > 0 ? (
            <span className="muted">
              {summary.unvaluedCount} ligne{summary.unvaluedCount > 1 ? "s" : ""} sans cote
            </span>
          ) : (
            <span className="muted">tout est valorisé</span>
          )}
        </div>
        <div className="tile">
          <span className="tile-label">Plus-value</span>
          <strong className={summary.gainCents >= 0 ? "up" : "down"}>
            {formatSignedCents(summary.gainCents)}
          </strong>
          <span className="muted">
            {change === undefined ? "—" : `${change > 0 ? "+" : ""}${change} %`}
          </span>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="panel">
          <h2>Inventaire vide</h2>
          <p className="hint">
            Ajoute ton premier article avec le formulaire ci-dessous.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Type</th>
                <th className="num">Qté</th>
                <th className="num">Achat</th>
                <th className="num">Valeur</th>
                <th className="num">Plus-value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/collection/${item.id}`}>{item.name}</Link>
                    {item.setName ? (
                      <span className="muted block">{item.setName}</span>
                    ) : null}
                  </td>
                  <td className="muted">{KIND_LABELS[item.kind]}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{formatCents(item.totalPurchaseCents)}</td>
                  <td className="num">
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
                  >
                    {item.gainCents === null
                      ? "—"
                      : formatSignedCents(item.gainCents)}
                  </td>
                  <td className="num">
                    <form action={deleteItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="link danger">
                        Supprimer
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title">Ajouter un article</h2>
      <ItemForm action={addItemAction} submitLabel="Ajouter" />
    </main>
  );
}
