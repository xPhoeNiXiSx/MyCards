"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { setIdOf } from "@/lib/card-number";
import { defaultSelection, isPocketSerie, selectSeries } from "@/lib/catalogue";
import { assetUrl, imageUrl } from "@/lib/images";
import type { CardResume, SerieDetail, SetDetail, SetResume } from "@/lib/tcgdex";

import { CardViewer } from "./card-viewer";
import { saveCatalogueSetsAction } from "./catalogue/actions";
import { OwnedContext, type Owned } from "./owned-context";
import { SetChooser } from "./set-chooser";

/**
 * Catalogue complet en accordéon à deux niveaux : série, puis set, puis les
 * cartes. Rien n'est chargé tant qu'un set n'est pas ouvert — le catalogue
 * compte environ 150 sets et plusieurs dizaines de milliers de cartes.
 */

type Counts =
  | { status: "off" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; bySet: Record<string, number> };

type Catalogue =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; series: SerieDetail[] };

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** En dessous, une recherche de cartes renverrait une bonne part du catalogue. */
const MIN_QUERY = 2;

/** Cartes affichées d'un coup dans les résultats, puis par tranche. */
const PAGE = 60;

type Search =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cards: CardResume[] };

export function SeriesBrowser({
  owned: initialOwned = {},
  hidePocket = true,
  savedSets = null,
}: {
  /** Exemplaires déjà possédés, par carte : lus en base par la page. */
  owned?: Record<string, number>;
  /** Réglage du compte : masquer la série Pokémon TCG Pocket. */
  hidePocket?: boolean;
  /** Extensions choisies. `null` : sélection par défaut. */
  savedSets?: string[] | null;
}) {
  const [saved, setSaved] = useState(savedSets);
  const [choosing, setChoosing] = useState(false);
  const [catalogue, setCatalogue] = useState<Catalogue>({ status: "loading" });
  const [ownedCounts, setOwnedCounts] = useState(initialOwned);
  const addOwned = useCallback((cardId: string, quantity: number) => {
    setOwnedCounts((counts) => ({
      ...counts,
      [cardId]: (counts[cardId] ?? 0) + quantity,
    }));
  }, []);
  const owned = useMemo<Owned>(
    () => ({ counts: ownedCounts, add: addOwned }),
    [ownedCounts, addOwned],
  );

  const [query, setQuery] = useState("");
  /** La recherche part après une courte pause dans la frappe, pas à chaque touche. */
  const [needle, setNeedle] = useState("");
  const [search, setSearch] = useState<Search>({ status: "idle" });

  useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const [rarities, setRarities] = useState<string[]>([]);
  /** `null` = toutes les raretés. Le filtre vaut pour tout l'écran. */
  const [rarity, setRarity] = useState<string | null>(null);
  /** Cartes de la rareté choisie, par set. `null` tant que rien n'est filtré. */
  const [counts, setCounts] = useState<Counts>({ status: "off" });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/series", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setCatalogue({ status: "ready", series: body as SerieDetail[] });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogue({
          status: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      });

    // Le filtre n'est pas vital : son échec ne doit pas emporter la page.
    fetch("/api/rarities", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((body) => setRarities(Array.isArray(body) ? body : []))
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  // Les cartes dont le nom correspond, dans tout le catalogue.
  useEffect(() => {
    if (needle.length < MIN_QUERY) {
      setSearch({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setSearch({ status: "loading" });
    const params =
      `q=${encodeURIComponent(needle)}` +
      (rarity ? `&rarity=${encodeURIComponent(rarity)}` : "");

    fetch(`/api/search?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setSearch({ status: "ready", cards: (body.cards ?? []) as CardResume[] });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearch({
          status: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      });

    return () => controller.abort();
  }, [needle, rarity]);

  // Quelles collections contiennent la rareté choisie, et combien.
  useEffect(() => {
    if (!rarity) {
      setCounts({ status: "off" });
      return;
    }

    const controller = new AbortController();
    setCounts({ status: "loading" });

    fetch(`/api/rarities?rarity=${encodeURIComponent(rarity)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setCounts({ status: "ready", bySet: body as Record<string, number> });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCounts({
          status: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      });

    return () => controller.abort();
  }, [rarity]);

  if (catalogue.status === "loading") {
    return (
      <div className="acc-list">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="acc-placeholder skeleton" key={index} />
        ))}
      </div>
    );
  }

  if (catalogue.status === "error") {
    return (
      <div className="panel">
        <h2>Le catalogue n&apos;a pas pu être chargé</h2>
        <p className="hint">
          {catalogue.message} — l&apos;appel passe par <code>/api/series</code>,
          qui interroge <code>api.tcgdex.net</code>.
        </p>
      </div>
    );
  }

  // Pocket (le jeu mobile) masqué partout si le réglage le demande : liste,
  // choix des extensions et recherche.
  const pocketSets = new Set(
    catalogue.series
      .filter((serie) => hidePocket && isPocketSerie(serie))
      .flatMap((serie) => serie.sets.map((set) => set.id)),
  );
  const available = catalogue.series.filter(
    (serie) => !(hidePocket && isPocketSerie(serie)),
  );
  const availableSets = available.reduce(
    (count, serie) => count + serie.sets.length,
    0,
  );

  // Seules les extensions choisies s'affichent : la liste complète compte
  // plus d'une centaine de collections, dont la plupart n'intéressent pas.
  const selection =
    saved ?? defaultSelection(available, Object.keys(ownedCounts));
  const chosen = selectSeries(available, new Set(selection));

  // Une collection sans carte de la rareté choisie n'a rien à montrer : elle
  // disparaît de la liste, et une série vidée de ses collections avec elle.
  const byRarity = (list: SerieDetail[]) =>
    counts.status === "ready"
      ? list
          .map((serie) => ({
            ...serie,
            sets: serie.sets.filter((set) => (counts.bySet[set.id] ?? 0) > 0),
          }))
          .filter((serie) => serie.sets.length > 0)
      : list;
  const series = byRarity(chosen);

  const totalSets = series.reduce(
    (count, serie) => count + serie.sets.length,
    0,
  );
  const searching = query.trim().length >= MIN_QUERY;

  if (choosing) {
    return (
      <SetChooser
        series={available}
        initial={selection}
        isDefault={saved === null}
        onCancel={() => setChoosing(false)}
        onSave={async (ids) => {
          const result = await saveCatalogueSetsAction(ids);
          if (!result.ok) return result.error ?? "Enregistrement impossible.";
          setSaved(ids);
          setChoosing(false);
          return null;
        }}
        onReset={async () => {
          const result = await saveCatalogueSetsAction(null);
          if (!result.ok) return result.error ?? "Enregistrement impossible.";
          setSaved(null);
          setChoosing(false);
          return null;
        }}
      />
    );
  }

  return (
    <OwnedContext.Provider value={owned}>
      <div className="catalogue-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher une extension ou une carte…"
          aria-label="Chercher dans le catalogue"
          enterKeyHint="search"
        />
      </div>

      <div className="toolbar">
        {rarities.length > 0 ? (
          <label className="rarity">
            <span>Rareté</span>
            <select
              value={rarity ?? ""}
              onChange={(event) => setRarity(event.target.value || null)}
            >
              <option value="">Toutes</option>
              {rarities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {searching ? null : (
          <div className="catalogue-meta">
            <span>
              {counts.status === "loading"
                ? "Recherche…"
                : `${plural(totalSets, "collection")} affichée${totalSets > 1 ? "s" : ""} sur ${availableSets}`}
            </span>
            <button
              type="button"
              className="choose-sets"
              onClick={() => setChoosing(true)}
            >
              Choisir les extensions
            </button>
          </div>
        )}
      </div>

      {counts.status === "error" ? (
        <p className="filter-note">
          Le tri par rareté a échoué ({counts.message}) : toutes les collections
          restent affichées.
        </p>
      ) : null}

      {searching ? (
        <SearchResults
          query={query.trim()}
          series={byRarity(available)}
          hiddenSets={pocketSets}
          search={needle === query.trim() ? search : { status: "loading" }}
          rarity={rarity}
          counts={counts.status === "ready" ? counts.bySet : undefined}
        />
      ) : chosen.length === 0 ? (
        <div className="panel">
          <h2>Aucune extension choisie</h2>
          <p className="hint">
            Choisis les extensions à afficher. La recherche, elle, porte
            toujours sur tout le catalogue.
          </p>
          <button
            type="button"
            className="choose-sets"
            onClick={() => setChoosing(true)}
          >
            Choisir les extensions
          </button>
        </div>
      ) : counts.status === "ready" && totalSets === 0 ? (
        <div className="panel">
          <h2>Aucune collection</h2>
          <p className="hint">
            Aucune carte « {rarity} » dans les extensions affichées.
          </p>
        </div>
      ) : (
        <div className="acc-list">
          {series.map((serie) => (
            <SeriePanel
              key={serie.id}
              serie={serie}
              rarity={rarity}
              counts={counts.status === "ready" ? counts.bySet : undefined}
            />
          ))}
        </div>
      )}
    </OwnedContext.Provider>
  );
}

/**
 * Résultats d'une recherche : les extensions dont le nom (ou celui de leur
 * série) correspond, puis les cartes dont le nom correspond. Un seul champ,
 * pas de mode à choisir : on tape ce qui vient, un Pokémon ou une extension.
 */
function SearchResults({
  query,
  series,
  hiddenSets,
  search,
  rarity,
  counts,
}: {
  query: string;
  series: SerieDetail[];
  /** Extensions masquées par les réglages (Pocket) : leurs cartes aussi. */
  hiddenSets: Set<string>;
  search: Search;
  rarity: string | null;
  counts?: Record<string, number>;
}) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [query]);

  const needle = normalize(query);
  const sets = series.flatMap((serie) =>
    normalize(serie.name).includes(needle)
      ? serie.sets
      : serie.sets.filter((set) => normalize(set.name).includes(needle)),
  );

  // Le catalogue est trié du plus récent au plus ancien : son ordre sert à
  // classer les cartes trouvées, et à retrouver le nom de leur extension.
  const bySet = useMemo(() => {
    const map = new Map<string, { name: string; rank: number }>();
    series
      .flatMap((serie) => serie.sets)
      .forEach((set, rank) => map.set(set.id, { name: set.name, rank }));
    return map;
  }, [series]);

  const cards = useMemo(() => {
    if (search.status !== "ready") return [];
    const rank = (card: CardResume) =>
      bySet.get(setIdOf(card.id) ?? "")?.rank ?? Number.MAX_SAFE_INTEGER;
    return search.cards
      .filter((card) => !hiddenSets.has(setIdOf(card.id) ?? ""))
      .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.localId.localeCompare(b.localId, "fr", { numeric: true }),
    );
  }, [search, bySet, hiddenSets]);

  const setNameOf = useCallback(
    (card: CardResume) => bySet.get(setIdOf(card.id) ?? "")?.name ?? null,
    [bySet],
  );

  return (
    <>
      <h2 className="results-title">
        Extensions <span>{sets.length}</span>
      </h2>
      {sets.length === 0 ? (
        <p className="hint">Aucune extension ne porte ce nom.</p>
      ) : (
        <div className="acc-list">
          {sets.map((set) => (
            <SetPanel
              key={set.id}
              set={set}
              rarity={rarity}
              count={counts?.[set.id]}
            />
          ))}
        </div>
      )}

      <h2 className="results-title">
        Cartes{" "}
        {search.status === "ready" ? <span>{cards.length}</span> : null}
      </h2>
      {search.status === "loading" || search.status === "idle" ? (
        <p className="hint">Recherche…</p>
      ) : search.status === "error" ? (
        <p className="hint">Recherche impossible : {search.message}</p>
      ) : cards.length === 0 ? (
        <p className="hint">
          Aucune carte ne porte ce nom
          {rarity ? ` dans la rareté « ${rarity} »` : ""}.
        </p>
      ) : (
        <>
          <CardGrid
            cards={cards.slice(0, shown)}
            setNameOf={setNameOf}
            caption={(card) =>
              [setNameOf(card), card.localId].filter(Boolean).join(" · ")
            }
          />
          {cards.length > shown ? (
            <button
              type="button"
              className="more-results"
              onClick={() => setShown((count) => count + PAGE)}
            >
              Afficher {Math.min(PAGE, cards.length - shown)} cartes de plus
            </button>
          ) : null}
        </>
      )}
    </>
  );
}

/** Grille de cartes cliquables, et la visionneuse qui s'ouvre dessus. */
function CardGrid({
  cards,
  setNameOf,
  caption,
}: {
  cards: CardResume[];
  setNameOf: (card: CardResume) => string | null;
  /** Ligne sous le nom (l'extension, en recherche). Sans, le seul numéro à côté. */
  caption?: (card: CardResume) => string;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  // La liste peut rétrécir sous la visionneuse (filtre, rareté) : un index
  // hors limites vaut fermeture.
  const index = viewing !== null && viewing < cards.length ? viewing : null;

  return (
    <>
      <div className="grid">
        {cards.map((card, position) => {
          const src = imageUrl(card.image);
          return (
            <article className="card" key={card.id}>
              <button
                type="button"
                className="frame"
                aria-label={`Agrandir ${card.name}`}
                onClick={() => setViewing(position)}
              >
                {src ? (
                  <img src={src} alt={card.name} loading="lazy" decoding="async" />
                ) : null}
              </button>
              <div className={caption ? "meta stacked" : "meta"}>
                <span className="name" title={card.name}>
                  {card.name}
                </span>
                <span className="num">
                  {caption ? caption(card) : card.localId}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <CardViewer
        cards={cards}
        index={index}
        onNavigate={setViewing}
        onClose={() => setViewing(null)}
        setNameOf={setNameOf}
      />
    </>
  );
}

function SeriePanel({
  serie,
  rarity,
  counts,
}: {
  serie: SerieDetail;
  rarity: string | null;
  counts?: Record<string, number>;
}) {
  return (
    <details className="acc">
      <summary>
        <span className="acc-title">{serie.name}</span>
        <span className="acc-meta">{plural(serie.sets.length, "collection")}</span>
      </summary>
      <div className="acc-body">
        {serie.sets.map((set) => (
          <SetPanel
            key={set.id}
            set={set}
            rarity={rarity}
            count={counts?.[set.id]}
          />
        ))}
      </div>
    </details>
  );
}

type Cards =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cards: CardResume[] };

/** Au-delà de ce nombre de cartes, un champ de recherche devient utile. */
const FILTER_THRESHOLD = 40;

function SetPanel({
  set,
  rarity,
  count,
}: {
  set: SetResume;
  rarity: string | null;
  /** Nombre de cartes de la rareté choisie, connu avant même d'ouvrir. */
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Cards>({ status: "idle" });
  const [search, setSearch] = useState("");

  /** Rareté pour laquelle les cartes en mémoire ont été chargées. */
  const loadedFor = useRef<string | null | undefined>(undefined);
  const logo = assetUrl(set.logo);

  useEffect(() => {
    if (!open) return;
    // Déjà chargé pour cette rareté : rouvrir ne redemande rien.
    if (loadedFor.current === rarity) return;

    const controller = new AbortController();
    loadedFor.current = rarity;
    setCards({ status: "loading" });

    const query = rarity ? `?rarity=${encodeURIComponent(rarity)}` : "";

    fetch(`/api/sets/${encodeURIComponent(set.id)}${query}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setCards({ status: "ready", cards: (body as SetDetail).cards ?? [] });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        loadedFor.current = undefined;
        setCards({
          status: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      });

    return () => controller.abort();
  }, [open, rarity, set.id]);

  const visible = useMemo(() => {
    if (cards.status !== "ready") return [];
    const needle = normalize(search.trim());
    if (needle === "") return cards.cards;
    return cards.cards.filter(
      (card) =>
        normalize(card.name).includes(needle) ||
        card.localId.toLowerCase().includes(needle),
    );
  }, [cards, search]);

  return (
    <details
      className="acc nested"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {logo ? <img className="acc-logo" src={logo} alt="" /> : null}
        <span className="acc-title">{set.name}</span>
        <span className="acc-meta">
          {plural(count ?? set.cardCount.official, "carte")}
        </span>
      </summary>

      <div className="acc-body">
        {cards.status === "loading" ? (
          <div className="grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="card" key={index}>
                <div className="frame skeleton" />
              </div>
            ))}
          </div>
        ) : null}

        {cards.status === "error" ? (
          <p className="hint">Cartes indisponibles : {cards.message}</p>
        ) : null}

        {cards.status === "ready" ? (
          <>
            {cards.cards.length > FILTER_THRESHOLD ? (
              <div className="filter">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Chercher par nom ou numéro…"
                  aria-label={`Filtrer les cartes de ${set.name}`}
                />
                <span className="count">
                  {visible.length === cards.cards.length
                    ? plural(cards.cards.length, "carte")
                    : `${visible.length} sur ${cards.cards.length}`}
                </span>
              </div>
            ) : null}

            {visible.length === 0 ? (
              <p className="hint">
                {rarity
                  ? `Aucune carte « ${rarity} » dans cette collection.`
                  : "Aucune carte ne correspond."}
              </p>
            ) : (
              <CardGrid cards={visible} setNameOf={() => set.name} />
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
