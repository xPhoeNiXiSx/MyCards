import Link from "next/link";

import { SetGallery } from "./set-gallery";

export default function HomePage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1 className="wordmark">
          My<span>Cards</span>
        </h1>
        <p>
          <Link href="/collection" className="nav-link">
            Mon inventaire
          </Link>
        </p>
      </header>
      <SetGallery />
    </main>
  );
}
