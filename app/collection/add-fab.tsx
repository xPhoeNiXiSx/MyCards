"use client";

import { useRef } from "react";

import { addItemAction } from "./actions";
import { ItemForm } from "./item-form";

/**
 * Bouton d'ajout flottant, toujours atteignable.
 *
 * Le formulaire s'ouvre par-dessus la page plutôt qu'en bas de celle-ci : la
 * liste peut être longue, et ajouter un article ne doit pas demander de la
 * parcourir. La boîte reste ouverte après un ajout, pour en enchaîner
 * plusieurs — c'est le cas courant quand on rentre ses achats.
 */
export function AddFab({ ownedSetIds }: { ownedSetIds: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="fab"
        aria-label="Ajouter un article"
        title="Ajouter un article"
        onClick={() => dialog.current?.showModal()}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </g>
        </svg>
      </button>

      <dialog ref={dialog} className="sheet" aria-labelledby="add-title">
        <div className="sheet-head">
          <h2 id="add-title">Ajouter un article</h2>
          <button
            type="button"
            className="sheet-close"
            aria-label="Fermer"
            onClick={() => dialog.current?.close()}
          >
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <ItemForm
            action={addItemAction}
            submitLabel="Ajouter"
            ownedSetIds={ownedSetIds}
          />
        </div>
      </dialog>
    </>
  );
}
