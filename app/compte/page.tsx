import { logoutAction } from "../login/actions";
import { Logo } from "../logo";
import { TabBar } from "../tab-bar";

export const dynamic = "force-dynamic";

export default function ComptePage() {
  return (
    <main className="page narrow">
      <header className="masthead">
        <h1 className="wordmark">
          <Logo />
          <span className="name">
            My<span>Cards</span>
          </span>
        </h1>
        <p>Mon compte</p>
      </header>

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
