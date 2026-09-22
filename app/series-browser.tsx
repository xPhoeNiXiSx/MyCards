"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { assetUrl, imageUrl } from "@/lib/images";
import type { CardResume, SerieDetail, SetDetail, SetResume } from "@/lib/tcgdex";

import { CardViewer } from "./card-viewer";

/**
 * Catalogue complet en accordéon à deux niveaux : série, puis set, puis les
 * cartes. Rien n'est chargé tant qu'un set n'est pas ouvert — le catalogue
 * compte environ 150 sets et plusieurs dizaines de milliers de cartes.
 */

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

export function SeriesBrowser() {
  const [catalogue, setCatalogue] = useState<Catalogue>({ status: "loading" });
  const [rarities, setRarities] = useState<string[]>([]);
  /** `null` = toutes les raretés. Le filtre vaut pour tout l'écran. */
  const [rarity, setRarity] = useState<string | null>(null);

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

  const totalSets = catalogue.series.reduce(
    (count, serie) => count + serie.sets.length,
    0,
  );

  return (
    <>
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

        <p className="catalogue-meta">
          {plural(catalogue.series.length, "série")} ·{" "}
          {plural(totalSets, "collection")}
        </p>
      </div>

      {rarity ? (
        <p className="filter-note">
          Les collections restent toutes listées : savoir lesquelles contiennent
          du « {rarity} » demanderait de les interroger une par une. Ouvre-en
          une pour voir ses cartes de cette rareté.
        </p>
      ) : null}

      <div className="acc-list">
        {catalogue.series.map((serie) => (
          <SeriePanel key={serie.id} serie={serie} rarity={rarity} />
        ))}
      </div>
    </>
  );
}

function SeriePanel({
  serie,
  rarity,
}: {
  serie: SerieDetail;
  rarity: string | null;
}) {
  return (
    <details className="acc">
      <summary>
        <span className="acc-title">{serie.name}</span>
        <span className="acc-meta">{plural(serie.sets.length, "collection")}</span>
      </summary>
      <div className="acc-body">
        {serie.sets.map((set) => (
          <SetPanel key={set.id} set={set} rarity={rarity} />
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

function SetPanel({ set, rarity }: { set: SetResume; rarity: string | null }) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Cards>({ status: "idle" });
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);

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
    setViewing(null);

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
          {cards.status === "ready" && rarity
            ? plural(cards.cards.length, "carte")
            : plural(set.cardCount.official, "carte")}
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
              <>
                <div className="grid">
                  {visible.map((card, position) => {
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
                            <img
                              src={src}
                              alt={card.name}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                        </button>
                        <div className="meta">
                          <span className="name" title={card.name}>
                            {card.name}
                          </span>
                          <span className="num">{card.localId}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <CardViewer
                  cards={visible}
                  index={viewing}
                  onNavigate={setViewing}
                  onClose={() => setViewing(null)}
                />
              </>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
