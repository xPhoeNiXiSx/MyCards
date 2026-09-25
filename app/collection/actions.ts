"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import {
  SCOPES,
  STATUSES,
  getItem,
  isCondition,
  isGrader,
  isLanguage,
  isSealedType,
  parseGrade,
  scopeOf,
  createItem,
  deleteItem,
  updateItem,
  type ItemInput,
  type ItemKind,
} from "@/lib/collection";
import { runMigrations } from "@/lib/db";
import { parseImageUrl } from "@/lib/images";
import { parseEuros } from "@/lib/money";

const KINDS: ItemKind[] = ["single", "sealed", "other"];

/** Les deux pages d'inventaire et le tableau de bord lisent les mêmes lignes. */
function revalidateInventory(): void {
  revalidatePath(SCOPES.cards.path);
  revalidatePath(SCOPES.sealed.path);
  revalidatePath("/");
}

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

export type ActionState = {
  error?: string;
  /** Nom du dernier article ajouté, pour le confirmer à l'écran. */
  added?: string;
  /** Change à chaque ajout : deux articles homonymes restent deux événements. */
  nonce?: number;
};

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

  const image = parseImageUrl(text(form, "imageUrl"));
  if (image === null) {
    return "L'adresse de l'image doit commencer par http:// ou https://.";
  }

  const rawStatus = text(form, "status");
  const status = STATUSES.find((candidate) => candidate === rawStatus) ?? "owned";

  const rawSealed = text(form, "sealedType");

  const rawLanguage = text(form, "language");
  const language = isLanguage(rawLanguage) ? rawLanguage : null;

  // État et gradation ne concernent que les cartes : un changement de type
  // les efface plutôt que de laisser un « PSA 10 » sur un coffret.
  const isCard = kind === "single";
  const rawGrader = isCard ? text(form, "grader") : null;
  const grader = isGrader(rawGrader) ? rawGrader : null;
  const grade = isCard ? parseGrade(text(form, "grade")) : undefined;
  if (grade === null) return "La note doit aller de 1 à 10, demi-points admis.";
  if (grader && grade === undefined) return "Indique la note de la gradation.";
  if (!grader && grade !== undefined) return "Indique qui a gradé la carte.";

  const rawCondition = isCard ? text(form, "condition") : null;
  // Une carte gradée est dans son boîtier : sa note remplace l'état.
  const condition = !grader && isCondition(rawCondition) ? rawCondition : null;

  return {
    status,
    kind,
    // Le sous-type ne vaut que pour le scellé : sur une carte, il n'a pas de
    // sens et ne doit pas survivre à un changement de type.
    sealedType: kind === "sealed" && isSealedType(rawSealed) ? rawSealed : null,
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
    imageUrl: image ?? null,
    notes: text(form, "notes"),
    language,
    condition,
    grader,
    grade: grade ?? null,
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
  revalidateInventory();
  return { added: input.name, nonce: Date.now() };
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
  revalidateInventory();
  // Retour à l'inventaire de l'article, tel qu'il est après modification.
  redirect(SCOPES[scopeOf(input.kind)].path);
}

export async function deleteItemAction(form: FormData): Promise<void> {
  await requireSession();

  const id = form.get("id");
  if (typeof id !== "string" || id === "") return;

  const item = await getItem(id);
  await deleteItem(id);
  revalidateInventory();
  // La fiche vient de disparaître : rester dessus afficherait un 404.
  redirect(SCOPES[item ? scopeOf(item.kind) : "cards"].path);
}

/**
 * Applique le schéma depuis l'application elle-même : la base n'est joignable
 * que par les fonctions serveur, jamais depuis un poste de développement.
 */
export async function migrateAction(): Promise<void> {
  await requireSession();
  await runMigrations();
  revalidateInventory();
  // La page du compte affiche la date du dernier passage : sans ça, le bouton
  // renverrait l'écran inchangé et on ne saurait pas s'il s'est passé quelque
  // chose.
  revalidatePath("/compte");
}
