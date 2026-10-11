"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import {
  SCOPES,
  createItem,
  getItem,
  isSealedType,
  markAsOwned,
  scopeOf,
  type ItemKind,
} from "@/lib/collection";
import { parseEuros } from "@/lib/money";

const KINDS: ItemKind[] = ["single", "sealed", "other"];

async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login?next=/liste");
}

function text(form: FormData, field: string): string | null {
  const value = form.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export type ActionState = {
  error?: string;
  added?: string;
  nonce?: number;
};

/** Un article visé porte le strict nécessaire : ce qu'on cherche, et rien de plus. */
export async function addWantedAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession();

  const name = text(form, "name");
  if (!name) return { error: "Le nom est obligatoire." };

  const rawKind = text(form, "kind");
  const kind = KINDS.find((candidate) => candidate === rawKind);
  if (!kind) return { error: "Type d'article invalide." };

  const rawSealed = text(form, "sealedType");

  await createItem({
    status: "wanted",
    kind,
    sealedType: kind === "sealed" && isSealedType(rawSealed) ? rawSealed : null,
    name,
    cardId: kind === "single" ? text(form, "cardId") : null,
    setName: null,
    quantity: 1,
    // Rien n'est encore payé ni possédé : ces champs se remplissent à l'achat.
    purchasePriceCents: 0,
    purchaseDate: null,
    manualValueCents: null,
    manualValueDate: null,
    imageUrl: null,
    notes: null,
    language: null,
    condition: null,
    grader: null,
    grade: null,
  });

  revalidatePath("/liste");
  return { added: name, nonce: Date.now() };
}

export async function markBoughtAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession();

  const id = text(form, "id");
  if (!id) return { error: "Article introuvable." };

  const price = parseEuros(text(form, "price"));
  if (price === null) return { error: "Le prix payé est invalide." };

  const rawDate = text(form, "date");
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

  await markAsOwned(id, price ?? 0, date ?? new Date().toISOString().slice(0, 10));
  const item = await getItem(id);

  revalidatePath("/liste");
  revalidatePath(SCOPES.cards.path);
  revalidatePath(SCOPES.sealed.path);
  revalidatePath("/");
  // L'article acheté rejoint son inventaire : cartes ou scellé.
  redirect(SCOPES[item ? scopeOf(item.kind) : "cards"].path);
}

export async function removeWantedAction(form: FormData): Promise<void> {
  await requireSession();

  const id = form.get("id");
  if (typeof id !== "string" || id === "") return;

  const { deleteItem } = await import("@/lib/collection");
  await deleteItem(id);
  revalidatePath("/liste");
}
