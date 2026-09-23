"use client";

import { useEffect, useRef, useState } from "react";

import type { SerieDetail } from "@/lib/tcgdex";

/** Case d'une série : cochée, décochée, ou entre les deux. */
function SerieCheckbox({
  checked,
  partial,
  onChange,
  label,
}: {
  checked: boolean;
  partial: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // `indeterminate` n'existe qu'en propriété DOM, pas en attribut HTML.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/**
 * Choix des extensions affichées dans le catalogue : une case par
 * extension, et une par série pour tout cocher ou décocher d'un coup.
 */
export function SetChooser({
  series,
  initial,
  isDefault,
  onSave,
  onReset,
  onCancel,
}: {
  series: SerieDetail[];
  initial: string[];
  /** La sélection de départ est celle par défaut, pas un choix enregistré. */
  isDefault: boolean;
  onSave: (ids: string[]) => Promise<string | null>;
  onReset: () => Promise<string | null>;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(() => new Set(initial));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const run = async (action: () => Promise<string | null>) => {
    setPending(true);
    setError(null);
    const failure = await action();
    setPending(false);
    if (failure) setError(failure);
  };

  return (
    <div className="chooser">
      <div className="chooser-head">
        <h2>Extensions affichées</h2>
        <p className="hint">
          {selected.size} extension{selected.size > 1 ? "s" : ""} choisie
          {selected.size > 1 ? "s" : ""}.{" "}
          {isDefault
            ? "Par défaut : la série la plus récente et les extensions que tu possèdes."
            : null}
        </p>
      </div>

      <div className="acc-list">
        {series.map((serie) => {
          const ids = serie.sets.map((set) => set.id);
          const count = ids.filter((id) => selected.has(id)).length;
          return (
            <details className="acc" key={serie.id} open={count > 0 && count < ids.length}>
              <summary>
                <SerieCheckbox
                  checked={count === ids.length}
                  partial={count > 0 && count < ids.length}
                  onChange={(on) => toggle(ids, on)}
                  label={`Toute la série ${serie.name}`}
                />
                <span className="acc-title">{serie.name}</span>
                <span className="acc-meta">
                  {count} / {ids.length}
                </span>
              </summary>
              <div className="acc-body chooser-sets">
                {serie.sets.map((set) => (
                  <label className="check-row" key={set.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(set.id)}
                      onChange={(event) => toggle([set.id], event.target.checked)}
                    />
                    <span>
                      {set.name}
                      <small>{set.cardCount.official} cartes</small>
                    </span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="chooser-actions">
        <button
          type="button"
          className="chooser-save"
          disabled={pending}
          onClick={() => run(() => onSave([...selected]))}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="chooser-secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </button>
        {isDefault ? null : (
          <button
            type="button"
            className="chooser-secondary"
            disabled={pending}
            onClick={() => run(onReset)}
          >
            Revenir au choix par défaut
          </button>
        )}
      </div>
    </div>
  );
}
