"use client";

import { useActionState, useRef } from "react";

import { markBoughtAction, type ActionState } from "./actions";

/**
 * Bascule un article visé dans la collection. Le prix réellement payé est
 * demandé ici : c'est la seule chose que la liste ne pouvait pas savoir.
 */
export function BuyButton({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    markBoughtAction,
    {},
  );

  return (
    <>
      <button
        type="button"
        className="buy-button"
        onClick={() => dialog.current?.showModal()}
      >
        Je l&apos;ai acheté
      </button>

      <dialog ref={dialog} className="confirm" aria-labelledby={`buy-${id}`}>
        <h2 id={`buy-${id}`}>{name}</h2>
        <p className="hint">
          Combien l&apos;as-tu payé ? L&apos;article rejoint la collection avec
          ce prix ; le reste suit tout seul.
        </p>

        <form action={action} className="form">
          <input type="hidden" name="id" value={id} />

          <div className="row">
            <label>
              Prix payé
              <input name="price" inputMode="decimal" placeholder="49,90" autoFocus />
            </label>
            <label>
              Date d&apos;achat
              <input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
          </div>

          {state.error ? <p className="error">{state.error}</p> : null}

          <div className="confirm-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => dialog.current?.close()}
            >
              Annuler
            </button>
            <button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Ajouter à ma collection"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
