import Link from "next/link";

import { LoginForm } from "./login-form";
import { SiteNav } from "../site-nav";

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
            My<span>Cards</span>
          </Link>
        </h1>
      </header>
      <LoginForm next={next ?? ""} />
      <SiteNav />
    </main>
  );
}
