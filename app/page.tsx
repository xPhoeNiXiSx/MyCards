import { Logo } from "./logo";
import { SetGallery } from "./set-gallery";
import { TabBar } from "./tab-bar";

export default function HomePage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1 className="wordmark">
          <Logo />
          <span className="name">
            My<span>Cards</span>
          </span>
        </h1>
        <p>Données : TCGdex — édition française</p>
      </header>
      <SetGallery />
      <TabBar />
    </main>
  );
}
