"use client";

import { useActionState } from "react";

import { formatCents } from "@/lib/money";

import { SubmitButton } from "../submit-button";
import { refreshSealedPricesAction, type PriceRefreshState } from "./actions";

/** Le bouton, puis le compte rendu de la dernière mise à jour. */
export function PriceRefresh() {
  const [state, action] = useActionState<PriceRefreshState>(
    refreshSealedPricesAction,
    {},
  );

  return (
    <>
      <form action={action} className="form">
        <SubmitButton pendingLabel="Recherche des prix…">
          Mettre à jour les prix
        </SubmitButton>
      </form>

      {state.error ? <p className="error">{state.error}</p> : null}

      {state.lines ? (
        <div className="ledger">
          <span className="ledger-title">Résultat</span>
          <ul>
            {state.lines.map((line) => (
              <li key={line.label}>
                <span>
                  {line.label}
                  {line.failures.length > 0 ? (
                    <small className="ledger-note">{line.failures.join(" · ")}</small>
                  ) : null}
                </span>
                <strong
                  className={
                    line.updated > 0
                      ? undefined
                      : line.kept === line.matched
                        ? "kept"
                        : "none"
                  }
                >
                  {line.updated > 0 && line.cents !== null
                    ? formatCents(line.cents)
                    : line.kept === line.matched
                      ? "saisi à la main"
                      : "non trouvé"}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
