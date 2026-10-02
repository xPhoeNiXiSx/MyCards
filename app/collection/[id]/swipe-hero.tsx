"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Sens du dernier passage, gardé le temps d'arriver sur la fiche suivante. */
const DIRECTION_KEY = "mycards.swipe";

/** Distance (px) au-delà de laquelle un glissement change de fiche. */
const THRESHOLD = 70;

type Direction = "prev" | "next";

/**
 * L'image de la fiche, qu'on fait glisser pour passer au produit précédent
 * ou suivant de l'inventaire — comme on feuillette un classeur. Deux flèches
 * et les touches ← → font la même chose, pour qui ne pense pas à glisser.
 *
 * Le glissement suit le doigt, puis l'image sort du côté où on l'a poussée
 * et la fiche suivante arrive du côté opposé. Le défilement vertical de la
 * page reste libre (`touch-action: pan-y`).
 */
export function SwipeHero({
  image,
  name,
  isCard,
  prevHref,
  nextHref,
  position,
  total,
}: {
  image: string | null;
  name: string;
  isCard: boolean;
  prevHref: string | null;
  nextHref: string | null;
  position: number;
  total: number;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const [entering, setEntering] = useState<Direction | null>(null);

  // Arrivée : la fiche entre du côté d'où l'on vient.
  useEffect(() => {
    try {
      const from = sessionStorage.getItem(DIRECTION_KEY);
      sessionStorage.removeItem(DIRECTION_KEY);
      if (from === "prev" || from === "next") setEntering(from);
    } catch {
      // Stockage indisponible (navigation privée) : on arrive sans animation.
    }
  }, []);

  // Les voisins sont préchargés : le passage est instantané.
  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [router, prevHref, nextHref]);

  const go = (direction: Direction) => {
    const href = direction === "prev" ? prevHref : nextHref;
    if (!href || leaving) return;
    try {
      sessionStorage.setItem(DIRECTION_KEY, direction);
    } catch {
      // Sans stockage, seule l'animation d'arrivée manque.
    }
    setLeaving(direction);
    // Le temps de voir l'image partir, puis on change de fiche.
    window.setTimeout(() => router.push(href), 160);
  };

  // Clavier : ← et →, sauf quand on écrit dans le formulaire.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go("prev");
      if (event.key === "ArrowRight") go("next");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY, horizontal: null };
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const origin = start.current;
    if (!origin) return;
    const touch = event.touches[0];
    const moveX = touch.clientX - origin.x;
    const moveY = touch.clientY - origin.y;
    // Le sens se décide au premier vrai mouvement : vertical, on laisse la
    // page défiler ; horizontal, l'image suit le doigt.
    if (origin.horizontal === null && Math.hypot(moveX, moveY) > 8) {
      origin.horizontal = Math.abs(moveX) > Math.abs(moveY);
    }
    if (!origin.horizontal) return;
    // Pas de voisin de ce côté : l'image résiste, elle ne fait que fléchir.
    const blocked = (moveX > 0 && !prevHref) || (moveX < 0 && !nextHref);
    setDx(blocked ? moveX / 4 : moveX);
  };

  const onTouchEnd = () => {
    const moved = dx;
    start.current = null;
    setDx(0);
    if (moved > THRESHOLD) go("prev");
    else if (moved < -THRESHOLD) go("next");
  };

  const stageClass = [
    "swipe-stage",
    dx !== 0 ? "dragging" : "",
    leaving ? `leave-${leaving}` : "",
    !leaving && entering ? `enter-${entering}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="swipe-hero"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {image ? (
        <figure className={isCard ? "item-hero card" : "item-hero"}>
          <span
            className={stageClass}
            style={
              dx !== 0
                ? { transform: `translateX(${dx}px) rotate(${dx / 40}deg)` }
                : undefined
            }
          >
            <span className="holo">
              <img src={image} alt={name} draggable={false} />
            </span>
          </span>
        </figure>
      ) : null}

      {total > 1 ? (
        <nav className="swipe-nav" aria-label="Produit précédent ou suivant">
          {prevHref ? (
            <Link
              href={prevHref}
              className="swipe-btn"
              aria-label="Produit précédent"
              onClick={(event) => {
                event.preventDefault();
                go("prev");
              }}
            >
              ‹
            </Link>
          ) : (
            <span className="swipe-btn" aria-hidden="true" />
          )}
          <span className="swipe-count">
            {position} / {total}
          </span>
          {nextHref ? (
            <Link
              href={nextHref}
              className="swipe-btn"
              aria-label="Produit suivant"
              onClick={(event) => {
                event.preventDefault();
                go("next");
              }}
            >
              ›
            </Link>
          ) : (
            <span className="swipe-btn" aria-hidden="true" />
          )}
        </nav>
      ) : null}
    </div>
  );
}
