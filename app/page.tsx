import { Wordmark } from "./wordmark";
import { SetGallery } from "./set-gallery";
import { TabBar } from "./tab-bar";

export default function HomePage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1 className="wordmark">
          <Wordmark />
        </h1>
        <p>Données : TCGdex — édition française</p>
      </header>
      <SetGallery />
      <TabBar />
    </main>
  );
}
