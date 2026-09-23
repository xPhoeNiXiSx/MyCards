"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  CONDITIONS,
  GRADERS,
  KIND_LABELS,
  LANGUAGES,
  SEALED_TYPES,
  type Item,
  type ItemKind,
} from "@/lib/collection";

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
  const [image, setImage] = useState(item?.imageUrl ?? "");
  // Gradée, la carte n'a plus d'état à saisir mais une note.
  const [grader, setGrader] = useState(item?.grader ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  // Après un ajout réussi, vider les champs : les laisser remplis laisse
  // croire que rien n'a été enregistré, et invite à ressaisir le même article.
  useEffect(() => {
    if (!state.nonce) return;
    formRef.current?.reset();
    setImage("");
    setGrader("");
  }, [state.nonce]);
  const isCard = kind === "single";
  const isSealed = kind === "sealed";

  return (
    <form ref={formRef} action={formAction} className="form">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {/* Modifier un article visé ne doit pas le faire entrer dans la
          collection : seul le bouton d'achat fait cette bascule. */}
      <input type="hidden" name="status" value={item?.status ?? "owned"} />

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

      {isSealed ? (
        <label>
          Type de scellé
          <select name="sealedType" defaultValue={item?.sealedType ?? "autre"}>
            {Object.entries(SEALED_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <small>Sert à filtrer la liste.</small>
        </label>
      ) : null}

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
          Date d&apos;achat
          <input
            name="purchaseDate"
            type="date"
            defaultValue={item?.purchaseDate ?? ""}
          />
        </label>
      </div>

      <div className="row">
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

      <label>
        Image (adresse)
        <div className="with-preview">
          <input
            name="imageUrl"
            inputMode="url"
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder="https://…"
          />
          {/* Aperçu immédiat : une adresse qui ne charge pas se voit tout de
              suite, plutôt qu'après enregistrement. */}
          {image.trim() !== "" ? (
            <img className="thumb" src={image} alt="" />
          ) : null}
        </div>
        <small>
          {isCard
            ? "Vide = le visuel de la carte chez TCGdex."
            : "TCGdex ne référence pas le scellé : colle l'adresse d'une image."}
        </small>
      </label>

      <details
        className="more"
        open={Boolean(
          item?.notes ||
            item?.setName ||
            item?.language ||
            item?.condition ||
            item?.grader,
        )}
      >
        <summary>Plus d&apos;options</summary>

        <div className="row">
          <label>
            Langue
            <select name="language" defaultValue={item?.language ?? "fr"}>
              {Object.entries(LANGUAGES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {isCard && grader === "" ? (
            <label>
              État
              <select name="condition" defaultValue={item?.condition ?? ""}>
                <option value="">Non précisé</option>
                {Object.entries(CONDITIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {isCard ? (
          <div className="row">
            <label>
              Gradation
              <select
                name="grader"
                value={grader}
                onChange={(event) => setGrader(event.target.value)}
              >
                <option value="">Non gradée</option>
                {Object.entries(GRADERS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {grader !== "" ? (
                <small>La cote Cardmarket vaut pour une carte brute : saisis la valeur.</small>
              ) : null}
            </label>

            {grader !== "" ? (
              <label className="narrow">
                Note
                <input
                  name="grade"
                  inputMode="decimal"
                  defaultValue={item?.grade?.replace(".", ",") ?? ""}
                  placeholder="10"
                  required
                />
              </label>
            ) : null}
          </div>
        ) : null}

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
      {state.added ? (
        <p className="success" role="status">
          « {state.added} » ajouté à ta collection.
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
