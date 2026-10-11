"use server";

import { revalidatePath } from "next/cache";

import { isAuthenticated } from "@/lib/auth";
import { createItem } from "@/lib/collection";
import { parseEuros } from "@/lib/money";
import { saveSetting } from "@/lib/settings";

export type QuickAddInput = {
  cardId: string;
  name: string;
  setName: string | null;
  price: string;
  date: string;
  quantity: string;
};

export type QuickAddResult =
  | { ok: true; id: string; quantity: number }
  | { ok: false; error: string };

/**
 * Ajout express depuis la visionneuse du catalogue : la carte est connue, il
 * ne reste que le prix, la date et la quantité. Le reste (état, gradation,
 * langue) se complète ensuite depuis la fiche de l'article.
 *
 * Une action serveur est une route HTTP à part entière : la session se
 * vérifie ici, pas seulement sur la page qui l'appelle.
 */
export async function quickAddAction(
  input: QuickAddInput,
): Promise<QuickAddResult> {
  if (!(await isAuthenticated())) {
    return { ok: false, error: "Session expirée : reconnecte-toi." };
  }

  const cardId = input.cardId?.trim();
  const name = input.name?.trim();
  if (!cardId || !name) return { ok: false, error: "Carte introuvable." };

  const price = parseEuros(input.price);
  if (price === null) return { ok: false, error: "Le prix est invalide." };

  const quantity = Number(input.quantity || "1");
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "La quantité doit être un entier positif." };
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;

  const item = await createItem({
    status: "owned",
    kind: "single",
    sealedType: null,
    name,
    cardId,
    setName: input.setName?.trim() || null,
    quantity,
    purchasePriceCents: price ?? 0,
    purchaseDate: date,
    manualValueCents: null,
    manualValueDate: null,
    imageUrl: null,
    notes: null,
    language: null,
    condition: null,
    grader: null,
    grade: null,
  });

  revalidatePath("/collection");
  revalidatePath("/");
  return { ok: true, id: item.id, quantity };
}

/**
 * Enregistre les extensions à afficher dans le catalogue. `null` revient à la
 * sélection par défaut.
 */
export async function saveCatalogueSetsAction(
  ids: string[] | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAuthenticated())) {
    return { ok: false, error: "Session expirée : reconnecte-toi." };
  }
  if (ids !== null && !(Array.isArray(ids) && ids.every((id) => typeof id === "string"))) {
    return { ok: false, error: "Sélection invalide." };
  }

  try {
    await saveSetting("catalogueSets", ids === null ? null : [...new Set(ids)]);
  } catch (error) {
    console.error("[catalogue] sélection non enregistrée", error);
    return {
      ok: false,
      error:
        "Enregistrement impossible. Si l'erreur persiste, applique les migrations depuis la page Compte.",
    };
  }
  revalidatePath("/catalogue");
  return { ok: true };
}
