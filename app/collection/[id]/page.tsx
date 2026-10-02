import { notFound, redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { SCOPES, getItem, scopeOf, valuate } from "@/lib/collection";

import { BackBar } from "../../back-bar";
import { TabBar } from "../../tab-bar";
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

  // Le visuel : l'image saisie, sinon celui de la carte chez TCGdex.
  const [valued] = await valuate([item]);
  const image = valued?.image ?? null;
  const isCard = item.kind === "single";

  return (
    <main className="page narrow">
      <BackBar
        href={SCOPES[scopeOf(item.kind)].path}
        label={isCard ? "Mes cartes" : "Mon scellé"}
      />

      {/* L'objet d'abord, en grand : c'est lui qu'on vient voir. */}
      {image ? (
        <figure className={isCard ? "item-hero card" : "item-hero"}>
          <span className="holo">
            <img src={image} alt={item.name} />
          </span>
        </figure>
      ) : null}

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
