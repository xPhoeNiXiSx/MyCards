import { SeriesBrowser } from "../series-browser";
import { TabBar } from "../tab-bar";
import { Wordmark } from "../wordmark";

export default function CataloguePage() {
  return (
    <main className="page">
      <header className="masthead">
        <div className="wordmark">
          <Wordmark />
        </div>
      </header>

      <h1 className="page-title">Catalogue</h1>
      <SeriesBrowser />
      <TabBar />
    </main>
  );
}
