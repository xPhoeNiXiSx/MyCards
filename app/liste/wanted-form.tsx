"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { KIND_LABELS, type ItemKind } from "@/lib/collection";

import { addWantedAction, type ActionState } from "./actions";

/**
 * Formulaire réduit au nécessaire : ce qu'on vise, et rien d'autre. Le prix
 * payé, la valeur et l'image se renseignent au moment de l'achat, quand ils
 * existent vraiment.
 */
export function WantedForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addWantedAction,
    {},
  );
  const [kind, setKind] = useState<ItemKind>("sealed");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.nonce) return;
    formRef.current?.reset();
  }, [state.nonce]);

  return (
    <form ref={formRef} action={action} className="form">
      <div className="row">
        <label className="narrow">
          Type
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as ItemKind)}
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="grow">
          Nom
          <input
            name="name"
            placeholder={
              kind === "single" ? "Dracaufeu ex" : "Display Écarlate et Violet"
            }
            required
          />
        </label>
      </div>

      {kind === "single" ? (
        <label>
          Identifiant TCGdex
          <input name="cardId" placeholder="30th-001" />
          <small>Renseigné, le visuel de la carte s&apos;affiche tout seul.</small>
        </label>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.added ? (
        <p className="success" role="status">
          « {state.added} » ajouté à ta liste.
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter à la liste"}
      </button>
    </form>
  );
}
