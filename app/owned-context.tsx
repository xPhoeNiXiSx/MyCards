"use client";

import { createContext } from "react";

/**
 * Exemplaires possédés par carte TCGdex, partagés par tout le catalogue : la
 * visionneuse les affiche, l'ajout express les incrémente sans recharger la
 * page.
 */
export type Owned = {
  counts: Record<string, number>;
  add: (cardId: string, quantity: number) => void;
};

export const OwnedContext = createContext<Owned>({
  counts: {},
  add: () => undefined,
});
