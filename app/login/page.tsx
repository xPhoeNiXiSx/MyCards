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
        <h1 className="wordmark">
          <Link href="/">
            <Wordmark />
          </Link>
        </h1>
      </header>
      <LoginForm next={next ?? ""} />
    </main>
  );
}
