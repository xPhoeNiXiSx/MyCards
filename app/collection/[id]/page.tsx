import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { SCOPES, getItem, scopeOf } from "@/lib/collection";

import { TabBar } from "../../tab-bar";
import { Wordmark } from "../../wordmark";
import { updateItemAction } from "../actions";
import { ItemForm } from "../item-form";
import { DeleteItem } from "./delete-item";

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
        <Link href={SCOPES[scopeOf(item.kind)].path} className="back">
          ← {item.kind === "single" ? "Mes cartes" : "Mon scellé"}
        </Link>
      </header>

      <h1 className="page-title">{item.name}</h1>
      <div className="panel">
        <ItemForm action={updateItemAction} item={item} submitLabel="Enregistrer" />
      </div>

      <div className="danger-zone">
        <DeleteItem id={item.id} name={item.name} />
      </div>

      <TabBar />
    </main>
  );
}
