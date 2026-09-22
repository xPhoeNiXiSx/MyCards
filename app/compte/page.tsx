import Link from "next/link";

import { migrateAction } from "../collection/actions";
import { logoutAction } from "../login/actions";
import { Wordmark } from "../wordmark";
import { TabBar } from "../tab-bar";

export const dynamic = "force-dynamic";

export default function ComptePage() {
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
          À lancer après une mise à jour qui ajoute des champs. L&apos;opération
          est sans risque et peut être rejouée : elle ne crée que ce qui manque
          et ne supprime jamais rien.
        </p>
        <form action={migrateAction} className="form">
          <button type="submit">Appliquer les migrations</button>
        </form>
      </div>

      <div className="panel">
        <h2>Réglages</h2>
        <p className="hint">
          Aucun réglage pour l&apos;instant. C&apos;est ici qu&apos;ils
          arriveront — devise, format des dates, sources de cotes.
        </p>
      </div>

      <TabBar />
    </main>
  );
}
