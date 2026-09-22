import Link from "next/link";

import { Logo } from "../logo";
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
            <Logo />
            <span className="name">
              My<span>Cards</span>
            </span>
          </Link>
        </h1>
      </header>
      <LoginForm next={next ?? ""} />
    </main>
  );
}
