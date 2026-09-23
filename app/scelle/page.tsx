import {
  InventoryPage,
  type InventorySearchParams,
} from "../collection/inventory-page";

// L'inventaire dépend de la session : jamais de rendu statique ici.
export const dynamic = "force-dynamic";

/**
 * Mon inventaire scellé : boosters, displays, coffrets… et les articles
 * « Autre », qui ne sont pas des cartes non plus. La fiche d'un article reste
 * sous `/collection/[id]`, commune aux deux inventaires.
 */
export default function SealedPage({
  searchParams,
}: {
  searchParams: InventorySearchParams;
}) {
  return <InventoryPage scope="sealed" searchParams={searchParams} />;
}
