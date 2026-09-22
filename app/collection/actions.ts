"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import {
  createItem,
  deleteItem,
  updateItem,
  type ItemInput,
  type ItemKind,
} from "@/lib/collection";
import { parseEuros } from "@/lib/money";

const KINDS: ItemKind[] = ["single", "sealed", "other"];

/**
 * Chaque action revérifie la session : une action serveur est une route HTTP à
 * part entière, la protection de la page qui l'affiche ne la couvre pas.
 */
async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/login?next=/collection");
  }
}

function text(form: FormData, field: string): string | null {
  const value = form.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function date(form: FormData, field: string): string | null {
  const value = text(form, field);
  // <input type="date"> renvoie déjà du YYYY-MM-DD ; on refuse le reste.
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export type ActionState = { error?: string };

function parse(form: FormData): ItemInput | string {
  const name = text(form, "name");
  if (!name) return "Le nom est obligatoire.";

  const rawKind = text(form, "kind");
  const kind = KINDS.find((candidate) => candidate === rawKind);
  if (!kind) return "Type d'article invalide.";

  const quantity = Number(text(form, "quantity") ?? "1");
  if (!Number.isInteger(quantity) || quantity < 1) {
    return "La quantité doit être un entier positif.";
  }

  const purchase = parseEuros(text(form, "purchasePrice"));
  if (purchase === null) return "Le prix d'achat est invalide.";

  const manual = parseEuros(text(form, "manualValue"));
  if (manual === null) return "La valeur actuelle est invalide.";

  const manualDate = date(form, "manualValueDate");

  return {
    kind,
    name,
    cardId: text(form, "cardId"),
    setName: text(form, "setName"),
    quantity,
    purchasePriceCents: purchase ?? 0,
    purchaseDate: date(form, "purchaseDate"),
    manualValueCents: manual ?? null,
    // Une valeur saisie sans date est datée d'aujourd'hui : sans ça on ne sait
    // plus de quand date la cote.
    manualValueDate:
      manual === undefined
        ? null
        : (manualDate ?? new Date().toISOString().slice(0, 10)),
    notes: text(form, "notes"),
  };
}

export async function addItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession();

  const input = parse(form);
  if (typeof input === "string") return { error: input };

  await createItem(input);
  revalidatePath("/collection");
  return {};
}

export async function updateItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession();

  const id = text(form, "id");
  if (!id) return { error: "Article introuvable." };

  const input = parse(form);
  if (typeof input === "string") return { error: input };

  await updateItem(id, input);
  revalidatePath("/collection");
  redirect("/collection");
}

export async function deleteItemAction(form: FormData): Promise<void> {
  await requireSession();

  const id = form.get("id");
  if (typeof id !== "string" || id === "") return;

  await deleteItem(id);
  revalidatePath("/collection");
}
