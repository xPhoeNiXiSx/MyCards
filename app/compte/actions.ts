"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { saveSetting } from "@/lib/settings";

export async function saveCatalogueSettingsAction(form: FormData): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login?next=/compte");

  // Case décochée : le champ est absent du formulaire.
  await saveSetting("hidePocket", form.get("hidePocket") === "on");

  revalidatePath("/catalogue");
  revalidatePath("/compte");
  redirect("/compte?enregistre=1");
}
