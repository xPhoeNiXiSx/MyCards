import Link from "next/link";

import { lastMigrationRun, migrationLedger } from "@/lib/data-migrations";
import { query } from "@/lib/db";
import { getSettingsOrDefaults } from "@/lib/settings";

import { migrateAction } from "../collection/actions";
import { SubmitButton } from "../submit-button";
import { saveCatalogueSettingsAction } from "./actions";
import { logoutAction } from "../login/actions";
import { Wordmark } from "../wordmark";
import { TabBar } from "../tab-bar";

export const dynamic = "force-dynamic";

/**
 * Date du dernier passage des migrations, à l'heure de Paris. La base peut ne
 * pas être joignable — la page du compte doit s'afficher quand même, c'est
 * justement là qu'on vient quand quelque chose cloche.
 */
async function lastRunLabel(): Promise<string> {
  try {
    const at = await lastMigrationRun(query);
    if (!at) return "Jamais appliquées depuis cet écran.";
    const when = at.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Dernière application : ${when.replace(" ", " à ")}.`;
  } catch {
    return "Dernière application : inconnue (base injoignable).";
  }
}

/** Combien de relevés afficher dans le journal : les plus récents. */
const LEDGER_SIZE = 4;

/**
 * Ce que les derniers relevés ont réellement posé, et ce qui reste sans
 * cote dans le scellé, avec le nom exact tel qu'il est saisi : c'est ce nom
 * qu'un relevé doit viser. Sans ce journal, un relevé qui ne trouve rien ne
 * se voit pas.
 */
async function migrationReport(): Promise<{
  ledger: { id: string; label: string; rows: number }[];
  unvalued: string[];
} | null> {
  try {
    const ledger = (await migrationLedger(query))
      .slice(-LEDGER_SIZE)
      .reverse()
      .map((row) => ({
        id: row.id,
        label: row.label,
        rows: Number(row.rows_touched),
      }));
    const unvalued = (
      await query<{ name: string }>(
        `select name from items
          where status = 'owned' and kind in ('sealed', 'other')
            and manual_value_cents is null
          order by name`,
      )
    ).map((row) => row.name);
    return { ledger, unvalued };
  } catch {
    return null;
  }
}

export default async function ComptePage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string }>;
}) {
  const { enregistre } = await searchParams;
  const settings = await getSettingsOrDefaults();
  const dernierPassage = await lastRunLabel();
  const report = await migrationReport();

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
          <SubmitButton pendingLabel="Déconnexion…">Se déconnecter</SubmitButton>
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
        <p className="hint">{dernierPassage}</p>
        <form action={migrateAction} className="form">
          <SubmitButton pendingLabel="Application…">
            Appliquer les migrations
          </SubmitButton>
        </form>

        {report && report.ledger.length > 0 ? (
          <div className="ledger">
            <span className="ledger-title">Derniers relevés de cotes</span>
            <ul>
              {report.ledger.map((row) => (
                <li key={row.id}>
                  <span>{row.label}</span>
                  <strong className={row.rows === 0 ? "none" : undefined}>
                    {row.rows === 0
                      ? "aucun article"
                      : `${row.rows} article${row.rows > 1 ? "s" : ""}`}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {report && report.unvalued.length > 0 ? (
          <div className="ledger">
            <span className="ledger-title">Scellé encore sans cote</span>
            <ul>
              {report.unvalued.map((name) => (
                <li key={name}>
                  {/* Entre guillemets : c'est le nom exact, espaces compris,
                      qu'un relevé doit viser. */}
                  <span>« {name} »</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        </form>
      </div>

      <TabBar />
    </main>
  );
}
