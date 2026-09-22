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

export type SerieResume = {
  id: string;
  name: string;
  logo?: string;
};

/** Une série et les sets qui la composent. */
export type SerieDetail = SerieResume & {
  sets: SetResume[];
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

/** Catalogue complet des sets, en résumé. */
export async function fetchSets(): Promise<SetResume[]> {
  return get<SetResume[]>("/sets");
}

/** Fiche d'un set désigné par son identifiant. */
export async function fetchSet(id: string): Promise<SetDetail> {
  return get<SetDetail>(`/sets/${encodeURIComponent(id)}`);
}

/** Fiche d'une série, avec la liste de ses sets. */
export async function fetchSerie(id: string): Promise<SerieDetail> {
  return get<SerieDetail>(`/series/${encodeURIComponent(id)}`);
}

/**
 * Catalogue complet : toutes les séries, chacune avec ses sets.
 *
 * TCGdex ne fournit pas les sets dans la liste des séries : il faut une
 * requête par série. Elles partent en parallèle et sont mises en cache une
 * heure, donc le visiteur ne paie ce coût qu'une fois par heure et par
 * déploiement. Le catalogue bouge de quelques sets par an.
 *
 * L'ordre de l'API est chronologique : on l'inverse pour présenter les séries
 * récentes en premier, et leurs sets de même.
 */
export async function fetchCatalogue(): Promise<SerieDetail[]> {
  const series = await get<SerieResume[]>("/series");

  const details = await Promise.allSettled(
    series.map((serie) => fetchSerie(serie.id)),
  );

  const resolved: SerieDetail[] = [];
  for (const result of details) {
    if (result.status === "rejected") {
      console.warn("[tcgdex] série indisponible", result.reason);
      continue;
    }
    // Une série sans set n'a rien à ouvrir : elle n'est pas listée.
    if (result.value.sets?.length) {
      resolved.push({ ...result.value, sets: [...result.value.sets].reverse() });
    }
  }

  return resolved.reverse();
}

/** Les 42 raretés du jeu, dans la langue de l'API. */
export async function fetchRarities(): Promise<string[]> {
  return get<string[]>("/rarities");
}

/**
 * Cartes d'un set, filtrées par rareté.
 *
 * `/sets/{id}` ignore les paramètres de filtre — il renvoie le set entier.
 * C'est `/cards` qui sait filtrer, et il accepte les deux critères ensemble.
 */
export async function fetchCardsOfSet(
  setId: string,
  rarity: string,
): Promise<CardResume[]> {
  // Construite à la main, et pas avec `URLSearchParams` : celui-ci encode les
  // deux-points en `%3A` et les espaces en `+`, alors que l'API attend le
  // préfixe `eq:` littéral et `%20`. La requête revenait vide.
  const query =
    `set=eq:${encodeURIComponent(setId)}` +
    `&rarity=eq:${encodeURIComponent(rarity)}`;

  return get<CardResume[]>(`/cards?${query}`);
}
