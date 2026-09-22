"use server";

import { redirect } from "next/navigation";

import { checkPassword, closeSession, openSession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _state: LoginState,
  form: FormData,
): Promise<LoginState> {
  const password = form.get("password");
  if (typeof password !== "string" || password === "") {
    return { error: "Saisis le mot de passe." };
  }

  if (!checkPassword(password)) {
    return { error: "Mot de passe incorrect." };
  }

  await openSession();

  const next = form.get("next");
  // On ne redirige que vers un chemin interne : un `next` absolu permettrait
  // de transformer la page de connexion en tremplin vers un autre site.
  const target =
    typeof next === "string" && /^\/[^/\\]/.test(next) ? next : "/collection";

  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await closeSession();
  redirect("/");
}
