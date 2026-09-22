import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { getItem } from "@/lib/collection";

import { TabBar } from "../../tab-bar";
import { Wordmark } from "../../wordmark";
import { updateItemAction } from "../actions";
import { ItemForm } from "../item-form";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/login?next=/collection");

  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  return (
    <main className="page narrow">
      <header className="masthead">
        <div className="wordmark">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
        <Link href="/collection" className="back">
          ← Inventaire
        </Link>
      </header>

      <h1 className="page-title">{item.name}</h1>
      <div className="panel">
        <ItemForm action={updateItemAction} item={item} submitLabel="Enregistrer" />
      </div>
      <TabBar />
    </main>
  );
}
