"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { SCOPES } from "@/lib/collection";
import { query } from "@/lib/db";
import { parisToday } from "@/lib/history";
import { refreshSealedPrices, type RefreshLine } from "@/lib/sealed-prices";
import { saveSetting } from "@/lib/settings";

export async function saveCatalogueSettingsAction(form: FormData): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login?next=/compte");

  // Case décochée : le champ est absent du formulaire.
  await saveSetting("hidePocket", form.get("hidePocket") === "on");

  revalidatePath("/catalogue");
  revalidatePath("/compte");
  redirect("/compte?enregistre=1");
}

export type PriceRefreshState = {
  lines?: RefreshLine[];
  error?: string;
};

/**
 * Va chercher les prix du scellé chez les sources du panel et pose ceux qui
 * ont été trouvés. Le compte rendu revient à l'écran, produit par produit.
 */
export async function refreshSealedPricesAction(): Promise<PriceRefreshState> {
  if (!(await isAuthenticated())) redirect("/login?next=/compte");

  try {
    const lines = await refreshSealedPrices(query, parisToday());
    revalidatePath(SCOPES.sealed.path);
    revalidatePath("/");
    return { lines: lines.filter((line) => line.matched > 0) };
  } catch (error) {
    console.error("[compte] mise à jour des prix", error);
    return { error: "La mise à jour a échoué. Les migrations sont-elles appliquées ?" };
  }
}
