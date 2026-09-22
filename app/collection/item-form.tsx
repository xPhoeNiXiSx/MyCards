"use client";

import { useActionState } from "react";

import { KIND_LABELS, type Item } from "@/lib/collection";

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

  return (
    <form action={formAction} className="panel form">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="row">
        <label>
          Type
          <select name="kind" defaultValue={item?.kind ?? "single"}>
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
            placeholder="Coffret dresseur d'élite 30 ans"
            required
          />
        </label>

        <label className="narrow">
          Quantité
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue={item?.quantity ?? 1}
          />
        </label>
      </div>

      <div className="row">
        <label className="grow">
          Identifiant TCGdex
          <input
            name="cardId"
            defaultValue={item?.cardId ?? ""}
            placeholder="30c-015"
          />
          <small>
            Pour une carte à l&apos;unité : renseigne-le et la cote Cardmarket
            est récupérée automatiquement. Laisse vide pour du scellé.
          </small>
        </label>

        <label className="grow">
          Extension
          <input
            name="setName"
            defaultValue={item?.setName ?? ""}
            placeholder="Célébration 30 ans"
          />
        </label>
      </div>

      <div className="row">
        <label>
          Prix d&apos;achat (unitaire)
          <input
            name="purchasePrice"
            inputMode="decimal"
            defaultValue={euros(item?.purchasePriceCents ?? null)}
            placeholder="49,90"
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
          Valeur actuelle (unitaire)
          <input
            name="manualValue"
            inputMode="decimal"
            defaultValue={euros(item?.manualValueCents ?? null)}
            placeholder="62,00"
          />
          <small>Prioritaire sur la cote automatique. Vide = cote marché.</small>
        </label>

        <label>
          Relevée le
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

      {state.error ? <p className="error">{state.error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
