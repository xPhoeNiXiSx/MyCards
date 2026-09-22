"use client";

import { useActionState, useState } from "react";

import { KIND_LABELS, type Item, type ItemKind } from "@/lib/collection";

import type { ActionState } from "./actions";

type Props = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  item?: Item;
  submitLabel: string;
};

function euros(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

export function ItemForm({ action, item, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    {},
  );
  // Le type pilote l'affichage : l'identifiant TCGdex n'a de sens que sur une
  // carte, et la cote automatique n'existe que dans ce cas.
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "single");
  const isCard = kind === "single";

  return (
    <form action={formAction} className="form">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

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
            defaultValue={item?.name ?? ""}
            placeholder={
              isCard ? "Dracaufeu ex" : "Coffret dresseur d'élite 30 ans"
            }
            required
          />
        </label>

        <label className="tiny">
          Qté
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue={item?.quantity ?? 1}
          />
        </label>
      </div>

      {isCard ? (
        <label>
          Identifiant TCGdex
          <input
            name="cardId"
            defaultValue={item?.cardId ?? ""}
            placeholder="30c-015"
          />
          <small>Renseigné, la cote Cardmarket est récupérée toute seule.</small>
        </label>
      ) : (
        <input type="hidden" name="cardId" value={item?.cardId ?? ""} />
      )}

      <div className="row">
        <label>
          Prix d&apos;achat (à l&apos;unité)
          <input
            name="purchasePrice"
            inputMode="decimal"
            defaultValue={euros(item?.purchasePriceCents ?? null)}
            placeholder="49,90"
          />
        </label>

        <label>
          Valeur actuelle (à l&apos;unité)
          <input
            name="manualValue"
            inputMode="decimal"
            defaultValue={euros(item?.manualValueCents ?? null)}
            placeholder={isCard ? "cote auto" : "62,00"}
          />
          <small>
            {isCard
              ? "Vide = cote Cardmarket automatique."
              : "À saisir : le scellé n'a pas de cote automatique."}
          </small>
        </label>
      </div>

      <details className="more" open={Boolean(item?.notes || item?.setName)}>
        <summary>Plus d&apos;options</summary>

        <div className="row">
          <label className="grow">
            Extension
            <input
              name="setName"
              defaultValue={item?.setName ?? ""}
              placeholder="Célébration 30 ans"
            />
          </label>

          <label>
            Date d&apos;achat
            <input
              name="purchaseDate"
              type="date"
              defaultValue={item?.purchaseDate ?? ""}
            />
          </label>

          <label>
            Valeur relevée le
            <input
              name="manualValueDate"
              type="date"
              defaultValue={item?.manualValueDate ?? ""}
            />
          </label>
        </div>

        <label>
          Notes
          <input
            name="notes"
            defaultValue={item?.notes ?? ""}
            placeholder="État, provenance, numéro de lot…"
          />
        </label>
      </details>

      {state.error ? <p className="error">{state.error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
