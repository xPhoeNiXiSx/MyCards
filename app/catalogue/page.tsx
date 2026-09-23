import { ownedCountsByCard } from "@/lib/collection";
import { isDatabaseConfigured } from "@/lib/db";

import { SeriesBrowser } from "../series-browser";
import { TabBar } from "../tab-bar";
import { Wordmark } from "../wordmark";

// Les cartes possédées se lisent en base à chaque visite.
export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  // Le catalogue vient de TCGdex et reste consultable sans base : seule la
  // mention « déjà dans l'inventaire » dépend d'elle, et manque en cas d'échec.
  let owned: Record<string, number> = {};
  if (isDatabaseConfigured()) {
    try {
      owned = await ownedCountsByCard();
    } catch (error) {
      console.warn("[catalogue] inventaire indisponible", error);
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <div className="wordmark">
          <Wordmark />
        </div>
      </header>

      <h1 className="page-title">Catalogue</h1>
      <SeriesBrowser owned={owned} />
      <TabBar />
    </main>
  );
}
