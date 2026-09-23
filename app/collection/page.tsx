import { InventoryPage, type InventorySearchParams } from "./inventory-page";

// L'inventaire dépend de la session : jamais de rendu statique ici.
export const dynamic = "force-dynamic";

/** Ma collection de cartes : les cartes à l'unité, et elles seules. */
export default function CardsPage({
  searchParams,
}: {
  searchParams: InventorySearchParams;
}) {
  return <InventoryPage scope="cards" searchParams={searchParams} />;
}
