import { isAuthConfigured, isAuthenticated } from "@/lib/auth";
import { KIND_LABELS, listItems, valuate } from "@/lib/collection";
import { isDatabaseConfigured } from "@/lib/db";
import { redirect } from "next/navigation";

import { DatabaseErrorScreen, SetupScreen } from "../db-screens";
import { TabBar } from "../tab-bar";
import { Wordmark } from "../wordmark";

import { BuyButton } from "./buy-button";
import { removeWantedAction } from "./actions";
import { WantedForm } from "./wanted-form";

export const dynamic = "force-dynamic";

const TITLE = "Ma liste";

export default async function ListePage() {
  const missing: string[] = [];
  if (!isAuthConfigured()) missing.push("APP_PASSWORD", "AUTH_SECRET");
  if (!isDatabaseConfigured()) missing.push("DATABASE_URL");
  if (missing.length > 0) return <SetupScreen title={TITLE} missing={missing} />;

  if (!(await isAuthenticated())) redirect("/login?next=/liste");

  let items;
  try {
    // Valorisés comme les autres : une carte visée montre sa cote du jour,
    // ce qui est précisément ce qu'on veut savoir avant d'acheter.
    items = await valuate(await listItems("wanted"));
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

  return (
    <main className="page narrow">
      <header className="masthead">
        <div className="wordmark">
          <Wordmark />
        </div>
      </header>

      <h1 className="page-title">{TITLE}</h1>

      {items.length === 0 ? (
        <div className="panel">
          <h2>Liste vide</h2>
          <p className="hint">
            Note ici les cartes et les produits scellés que tu cherches. Quand
            tu en achètes un, il rejoint ta collection sans ressaisie.
          </p>
        </div>
      ) : (
        <ul className="wanted">
          {items.map((item) => (
            <li key={item.id}>
              {item.image ? (
                <img className="thumb" src={item.image} alt="" />
              ) : (
                <span className="thumb empty" aria-hidden="true" />
              )}

              <div className="wanted-text">
                <strong>{item.name}</strong>
                <span className="muted">
                  {KIND_LABELS[item.kind]}
                  {item.currentUnitCents !== null
                    ? ` · cote ${(item.currentUnitCents / 100)
                        .toFixed(2)
                        .replace(".", ",")} €`
                    : ""}
                </span>
              </div>

              <div className="wanted-actions">
                <BuyButton id={item.id} name={item.name} />
                <form action={removeWantedAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="link danger">
                    Retirer
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="panel disclosure" open={items.length === 0}>
        <summary>
          <span>Viser un article</span>
        </summary>
        <WantedForm />
      </details>

      <TabBar />
    </main>
  );
}
