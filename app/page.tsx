import { Wordmark } from "./wordmark";
import { SetGallery } from "./set-gallery";
import { TabBar } from "./tab-bar";

export default function HomePage() {
  return (
    <main className="page">
      <header className="masthead">
        <div className="wordmark">
          <Wordmark />
        </div>
      </header>

      <h1 className="page-title">Collection</h1>
      <SetGallery />
      <TabBar />
    </main>
  );
}
