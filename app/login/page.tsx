import Link from "next/link";

import { Wordmark } from "../wordmark";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="page narrow">
      <header className="masthead">
        <div className="wordmark">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
      </header>

      <h1 className="page-title">Connexion</h1>
      <LoginForm next={next ?? ""} />
    </main>
  );
}
