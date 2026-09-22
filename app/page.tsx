import { SetGallery } from "./set-gallery";
import { SiteNav } from "./site-nav";

export default function HomePage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1 className="wordmark">
          My<span>Cards</span>
        </h1>
        <p>Données : TCGdex — édition française</p>
      </header>
      <SetGallery />
      <SiteNav />
    </main>
  );
}
