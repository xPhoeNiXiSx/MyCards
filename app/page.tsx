import { Wordmark } from "./wordmark";
import { SeriesBrowser } from "./series-browser";
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
      <SeriesBrowser />
      <TabBar />
    </main>
  );
}
