"use client";

import { useRef } from "react";

import { deleteItemAction } from "../actions";

/**
 * Suppression d'un article, derrière une confirmation.
 *
 * S'appuie sur l'élément natif `dialog` plutôt que sur une reconstruction :
 * il apporte le piège de focus, la fermeture par Échap et l'inertie du reste
 * de la page, qu'il faudrait sinon réécrire — mal.
 */
export function DeleteItem({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="danger-button"
        onClick={() => dialog.current?.showModal()}
      >
        Supprimer cet article
      </button>

      <dialog ref={dialog} className="confirm" aria-labelledby="confirm-title">
        <h2 id="confirm-title">Supprimer « {name} » ?</h2>
        <p className="hint">
          La ligne disparaît de l&apos;inventaire, avec son prix d&apos;achat et
          sa valeur. C&apos;est définitif.
        </p>

        <div className="confirm-actions">
          {/* Annuler vient en premier : c'est lui qui reçoit le focus à
              l'ouverture, donc une validation au clavier ne supprime rien. */}
          <button
            type="button"
            className="ghost-button"
            onClick={() => dialog.current?.close()}
          >
            Annuler
          </button>

          <form action={deleteItemAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="danger-button solid">
              Supprimer
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
