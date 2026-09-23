"use client";

import Link from "next/link";
import { useContext, useState, useTransition } from "react";

import type { CardResume } from "@/lib/tcgdex";

import { quickAddAction } from "./catalogue/actions";
import { OwnedContext } from "./owned-context";

/** Aujourd'hui, au format du champ `date` (AAAA-MM-JJ), dans le fuseau local. */
function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/**
 * Ajout express d'une carte du catalogue : prix, date, quantité, et c'est
 * tout. On reste dans la visionneuse pour enchaîner avec la carte suivante ;
 * la fiche complète (état, gradation, langue) s'ouvre depuis la confirmation.
 */
export function QuickAdd({
  card,
  setName,
}: {
  card: CardResume;
  setName: string | null;
}) {
  const owned = useContext(OwnedContext);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("1");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { kind: "added"; id: string } | { kind: "error"; message: string } | null
  >(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const outcome = await quickAddAction({
          cardId: card.id,
          name: card.name,
          setName,
          price,
          date,
          quantity,
        });
        if (!outcome.ok) {
          setResult({ kind: "error", message: outcome.error });
          return;
        }
        owned.add(card.id, outcome.quantity);
        setPrice("");
        setQuantity("1");
        setResult({ kind: "added", id: outcome.id });
      } catch {
        setResult({ kind: "error", message: "Ajout impossible, réessaie." });
      }
    });
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-fields">
        <label>
          Prix
          <input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0,00"
            aria-label={`Prix d'achat de ${card.name}`}
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="qty">
          Qté
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
      </div>

      <button type="submit" className="quick-submit" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter à l'inventaire"}
      </button>

      {result?.kind === "added" ? (
        <p className="quick-done" role="status">
          « {card.name} » ajouté.{" "}
          <Link href={`/collection/${result.id}`}>Compléter la fiche →</Link>
        </p>
      ) : null}
      {result?.kind === "error" ? (
        <p className="error" role="alert">
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
