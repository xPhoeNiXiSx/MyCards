"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SEALED_TYPES, type SealedType } from "@/lib/collection";

/**
 * Filtre par type de scellé. Le choix passe par l'URL plutôt que par un état
 * local : la page est rendue côté serveur, et une liste filtrée reste ainsi
 * partageable et retrouvable par l'historique du navigateur.
 *
 * Seuls les types réellement présents dans l'inventaire sont proposés — offrir
 * un filtre qui ne renvoie rien n'aide personne.
 */
export function TypeFilter({
  available,
  current,
}: {
  available: SealedType[];
  current: SealedType | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (available.length < 2) return null;

  return (
    <label className="rarity">
      <span>Type</span>
      <select
        value={current ?? ""}
        onChange={(event) => {
          const next = new URLSearchParams(params);
          if (event.target.value) next.set("type", event.target.value);
          else next.delete("type");

          const query = next.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <option value="">Tous les articles</option>
        {available.map((type) => (
          <option key={type} value={type}>
            {SEALED_TYPES[type]}
          </option>
        ))}
      </select>
    </label>
  );
}
