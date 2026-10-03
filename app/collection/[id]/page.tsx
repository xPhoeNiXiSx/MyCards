import { notFound, redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import {
  SCOPES,
  getItem,
  inScope,
  itemNeighbors,
  listItems,
  scopeOf,
  valuate,
} from "@/lib/collection";

import { buildItemChart } from "@/lib/dashboard";
import { itemValueSeries, parisToday, recordItemValues } from "@/lib/history";

import { BackBar } from "../../back-bar";
import { TabBar } from "../../tab-bar";
import { updateItemAction } from "../actions";
import { ItemForm } from "../item-form";
import { DeleteItem } from "./delete-item";
import { ItemGain, type ItemChartMode } from "./item-gain";
import { SwipeHero } from "./swipe-hero";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ courbe?: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/login?next=/collection");

  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  // Le visuel : l'image saisie, sinon celui de la carte chez TCGdex.
  const [valued] = await valuate([item]);
  const image = valued?.image ?? null;
  const isCard = item.kind === "single";
  const scope = scopeOf(item.kind);
  const mode: ItemChartMode =
    (await searchParams).courbe === "plus-value" ? "plus-value" : "cote";

  // La cote du jour entre dans l'historique à chaque ouverture de la fiche,
  // puis la courbe se lit. Un échec (schéma pas encore migré) ne coûte que
  // la courbe.
  let chart = null;
  if (valued && item.status === "owned") {
    try {
      await recordItemValues([valued]);
      chart = buildItemChart(
        await itemValueSeries(item.id),
        item.purchasePriceCents,
        item.quantity,
        item.purchaseDate,
        parisToday(),
      );
    } catch (error) {
      console.warn("[fiche] historique de la cote indisponible", error);
    }
  }

  // Voisins dans l'inventaire de l'article, pour passer d'une fiche à
  // l'autre. Un article visé n'est pas dans l'inventaire : pas de voisins.
  const neighbors =
    item.status === "owned"
      ? itemNeighbors(
          (await listItems("owned")).filter((line) => inScope(line, scope)),
          item.id,
        )
      : null;

  return (
    <main className="page narrow">
      <BackBar
        href={SCOPES[scope].path}
        label={isCard ? "Mes cartes" : "Mon scellé"}
      />

      {/* L'objet d'abord, en grand : c'est lui qu'on vient voir. On le fait
          glisser pour passer au produit voisin. */}
      <SwipeHero
        key={item.id}
        image={image}
        name={item.name}
        isCard={isCard}
        prevHref={neighbors?.prev ? `/collection/${neighbors.prev}` : null}
        nextHref={neighbors?.next ? `/collection/${neighbors.next}` : null}
        position={neighbors?.position ?? 1}
        total={neighbors?.total ?? 1}
      />

      <h1 className="page-title">{item.name}</h1>
      {valued && item.status === "owned" ? (
        <ItemGain item={valued} chart={chart} mode={mode} />
      ) : null}
      <div className="panel">
        <ItemForm action={updateItemAction} item={item} submitLabel="Enregistrer" />
      </div>

      <div className="danger-zone">
        <DeleteItem id={item.id} name={item.name} />
      </div>

      <TabBar current={SCOPES[scope].path} />
    </main>
  );
}
