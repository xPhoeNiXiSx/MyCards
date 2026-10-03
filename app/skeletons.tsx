import { TabBar } from "./tab-bar";
import { Wordmark } from "./wordmark";

/**
 * Squelettes affichés pendant le chargement d'une page (fichiers
 * `loading.tsx`). Ils reprennent la forme de la page attendue, pour que
 * l'arrivée du contenu ne fasse rien sauter, et un reflet balaie les blocs
 * pour dire que ça travaille. Ils portent la barre d'onglets : la navigation
 * reste disponible pendant l'attente.
 */

function Block({ className = "" }: { className?: string }) {
  return <span className={`skeleton sk ${className}`} aria-hidden="true" />;
}

/** Annonce discrète pour les lecteurs d'écran. */
function Status() {
  return (
    <p className="sr-only" role="status">
      Chargement…
    </p>
  );
}

/** Accueil et pages sans squelette propre. */
export function PageSkeleton() {
  return (
    <main className="page">
      <Status />
      <div className="sk-cover">
        <Wordmark className="sk-logo" />
      </div>
      <div className="sk-summary">
        <Block className="sk-line w40" />
        <Block className="sk-value" />
        <Block className="sk-line w60" />
        <Block className="sk-chart" />
      </div>
      <div className="sk-tiles">
        <Block className="sk-tile" />
        <Block className="sk-tile" />
      </div>
      <Block className="sk-panel" />
      <TabBar />
    </main>
  );
}

/** Ma collection de cartes et Mon inventaire scellé. */
export function InventorySkeleton({ title }: { title: string }) {
  return (
    <main className="page">
      <Status />
      <header className="masthead">
        <div className="wordmark">
          <Wordmark />
        </div>
      </header>
      <h1 className="page-title">{title}</h1>
      <div className="sk-summary">
        <Block className="sk-line w40" />
        <Block className="sk-value" />
        <Block className="sk-line w60" />
      </div>
      <div className="sk-rows">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="sk-row" key={index}>
            <Block className="sk-thumb" />
            <div className="sk-lines">
              <Block className="sk-line w70" />
              <Block className="sk-line w40" />
            </div>
          </div>
        ))}
      </div>
      <TabBar />
    </main>
  );
}

/** Fiche d'un article : retour, image en grand, formulaire. */
export function ItemSkeleton() {
  return (
    <main className="page narrow">
      <Status />
      <div className="backbar">
        <Block className="sk-back" />
      </div>
      <div className="sk-hero">
        <Block className="sk-card" />
      </div>
      <Block className="sk-line w60 sk-title" />
      <Block className="sk-panel tall" />
      <TabBar />
    </main>
  );
}
