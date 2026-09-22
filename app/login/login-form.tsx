"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={action} className="panel form">
      <p className="hint">
        L&apos;inventaire est privé. La galerie d&apos;accueil, elle, reste
        accessible à tous.
      </p>

      <input type="hidden" name="next" value={next} />

      <label>
        Mot de passe
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Vérification…" : "Se connecter"}
      </button>
    </form>
  );
}
