/**
 * Client minimal pour l'API TCGdex (https://tcgdex.dev).
 * Gratuite, sans clé d'API. On interroge la locale française.
 */

const API = "https://api.tcgdex.net/v2/fr";

/** Durée de cache des réponses, en secondes. Un set ne bouge quasiment jamais. */
const REVALIDATE = 3600;

export type SetResume = {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
};

export type CardResume = {
  id: string;
  localId: string;
  name: string;
  image?: string;
};

export type SetDetail = SetResume & {
  releaseDate?: string;
  serie?: { id: string; name: string };
  cards: CardResume[];
};

export type CardDetail = CardResume & {
  rarity?: string;
  set?: { id: string; name: string };
  pricing?: unknown;
};

export type SetPayload = {
  set: SetDetail;
  /** Set jumeau (la sous-collection « Classique »), s'il a été trouvé. */
  companion?: { id: string; name: string; cardCount: SetResume["cardCount"] };
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Repère les sets de l'anniversaire des 30 ans parmi la liste complète. */
function isAnniversary(set: SetResume): boolean {
  const name = normalize(set.name);
  return /\b30\b|30e|30eme|30th|30 ans/.test(name) || /^30/.test(set.id);
}

/** La sous-collection reprend des cartes iconiques : son nom porte « classi ». */
function isClassicCollection(set: SetResume): boolean {
  return /classi/.test(normalize(set.name));
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE },
  });

  if (!response.ok) {
    throw new Error(`TCGdex ${path} a répondu ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Résout le set « 30 ans » par son nom plutôt qu'en codant en dur un
 * identifiant : celui-ci a déjà changé pendant l'intégration du set chez
 * TCGdex. `TCGDEX_SET_ID` permet de forcer un identifiant précis au besoin.
 */
export async function fetchAnniversarySet(): Promise<SetPayload> {
  const forced = process.env.TCGDEX_SET_ID;
  if (forced) {
    return { set: await get<SetDetail>(`/sets/${forced}`) };
  }

  const sets = await get<SetResume[]>("/sets");
  const candidates = sets.filter(isAnniversary);

  if (candidates.length === 0) {
    throw new Error(
      "Aucun set « 30 ans » trouvé dans le catalogue TCGdex français.",
    );
  }

  const main =
    candidates.find((set) => !isClassicCollection(set)) ??
    // Repli : à défaut, le set le plus fourni est le set principal.
    candidates.reduce((biggest, set) =>
      set.cardCount.official > biggest.cardCount.official ? set : biggest,
    );

  const companion = candidates.find(
    (set) => set.id !== main.id && isClassicCollection(set),
  );

  return {
    set: await get<SetDetail>(`/sets/${main.id}`),
    companion: companion && {
      id: companion.id,
      name: companion.name,
      cardCount: companion.cardCount,
    },
  };
}

/** Fiche complète d'une carte, cote comprise. */
export async function fetchCard(id: string): Promise<CardDetail> {
  return get<CardDetail>(`/cards/${encodeURIComponent(id)}`);
}
