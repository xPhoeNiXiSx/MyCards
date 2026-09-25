import Link from "next/link";

import { getSettingsOrDefaults } from "@/lib/settings";

import { migrateAction } from "../collection/actions";
import { saveCatalogueSettingsAction } from "./actions";
import { logoutAction } from "../login/actions";
import { Wordmark } from "../wordmark";
import { TabBar } from "../tab-bar";

export const dynamic = "force-dynamic";

export default async function ComptePage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string }>;
}) {
  const { enregistre } = await searchParams;
  const settings = await getSettingsOrDefaults();

  return (
    <main className="page narrow">
      <header className="masthead">
        <div className="wordmark">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
      </header>

      <h1 className="page-title">Mon compte</h1>

      <div className="panel">
        <h2>Session</h2>
        <p className="hint">
          Tu es connecté. L&apos;accès à l&apos;application est protégé par un
          mot de passe unique, défini dans les variables d&apos;environnement.
        </p>
        <form action={logoutAction} className="form">
          <button type="submit">Se déconnecter</button>
        </form>
      </div>

      <div className="panel">
        <h2>Base de données</h2>
        <p className="hint">
          À lancer après une mise à jour qui ajoute des champs, ou qui apporte
          des cotes relevées en ligne. L&apos;opération est sans risque et peut
          être rejouée : elle ne crée que ce qui manque, ne touche jamais une
          valeur saisie ici, et ne supprime jamais rien.
        </p>
        <form action={migrateAction} className="form">
          <button type="submit">Appliquer les migrations</button>
        </form>
      </div>

      <div className="panel">
        <h2>Catalogue</h2>
        <form action={saveCatalogueSettingsAction} className="form">
          <label className="check-row">
            <input
              type="checkbox"
              name="hidePocket"
              defaultChecked={settings.hidePocket}
            />
            <span>
              Masquer Pokémon TCG Pocket
              <small>
                Les extensions du jeu mobile, qui n&apos;existent pas en cartes
                physiques. Elles disparaissent aussi de la recherche.
              </small>
            </span>
          </label>
          <p className="hint">
            Les extensions affichées se choisissent dans le catalogue, avec le
            bouton « Choisir les extensions ».
          </p>
          {enregistre ? (
            <p className="success" role="status">
              Réglages enregistrés.
            </p>
          ) : null}
          <button type="submit">Enregistrer</button>
        </form>
      </div>

      <TabBar />
    </main>
  );
}
