import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { getItem } from "@/lib/collection";

import { TabBar } from "../../tab-bar";
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
        <h1 className="wordmark">
          <Link href="/collection">← Inventaire</Link>
        </h1>
      </header>

      <h2 className="section-title">{item.name}</h2>
      <div className="panel">
        <ItemForm action={updateItemAction} item={item} submitLabel="Enregistrer" />
      </div>
      <TabBar />
    </main>
  );
}
