"use client";

import { useEffect, useRef } from "react";

import { imageUrl } from "@/lib/images";
import type { CardResume } from "@/lib/tcgdex";

/**
 * Visionneuse plein écran, avec navigation d'une carte à l'autre.
 *
 * Sur `dialog` natif, comme la confirmation de suppression : piège de focus,
 * fermeture par Échap et inertie de la page derrière sont gratuits.
 */
export function CardViewer({
  cards,
  index,
  onNavigate,
  onClose,
}: {
  cards: CardResume[];
  /** `null` quand la visionneuse est fermée. */
  index: number | null;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = index !== null;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // Les flèches sont le réflexe au clavier ; Échap est géré par `dialog`.
  useEffect(() => {
    if (index === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (event.key === "ArrowRight" && index < cards.length - 1) {
        onNavigate(index + 1);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, cards.length, onNavigate]);

  const card = index === null ? undefined : cards[index];
  const src = imageUrl(card?.image, "high");

  return (
    <dialog ref={dialog} className="viewer" onClose={onClose}>
      {card && index !== null ? (
        <>
          <div className="viewer-stage">
            {src ? (
              <img src={src} alt={card.name} />
            ) : (
              <p className="hint">Pas de visuel pour cette carte.</p>
            )}
          </div>

          <div className="viewer-bar">
            <button
              type="button"
              className="viewer-nav"
              aria-label="Carte précédente"
              disabled={index === 0}
              onClick={() => onNavigate(index - 1)}
            >
              ‹
            </button>

            <div className="viewer-label">
              <strong>{card.name}</strong>
              <span>
                {card.localId} · {index + 1} / {cards.length}
              </span>
            </div>

            <button
              type="button"
              className="viewer-nav"
              aria-label="Carte suivante"
              disabled={index === cards.length - 1}
              onClick={() => onNavigate(index + 1)}
            >
              ›
            </button>
          </div>

          <button
            type="button"
            className="viewer-close"
            aria-label="Fermer"
            onClick={() => dialog.current?.close()}
          >
            ✕
          </button>
        </>
      ) : null}
    </dialog>
  );
}
