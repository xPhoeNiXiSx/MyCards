"use client";

import { useEffect, useMemo, useState } from "react";

import { assetUrl, imageUrl } from "@/lib/images";
import type { CardResume, SerieDetail, SetDetail, SetResume } from "@/lib/tcgdex";

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
      <p className="catalogue-meta">
        {plural(catalogue.series.length, "série")} ·{" "}
        {plural(totalSets, "collection")}
      </p>

      <div className="acc-list">
        {catalogue.series.map((serie) => (
          <SeriePanel key={serie.id} serie={serie} />
        ))}
      </div>
    </>
  );
}

function SeriePanel({ serie }: { serie: SerieDetail }) {
  return (
    <details className="acc">
      <summary>
        <span className="acc-title">{serie.name}</span>
        <span className="acc-meta">{plural(serie.sets.length, "collection")}</span>
      </summary>
      <div className="acc-body">
        {serie.sets.map((set) => (
          <SetPanel key={set.id} set={set} />
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

function SetPanel({ set }: { set: SetResume }) {
  const [cards, setCards] = useState<Cards>({ status: "idle" });
  const [search, setSearch] = useState("");
  const logo = assetUrl(set.logo);

  /** Chargé au premier dépliage seulement : rouvrir ne redemande rien. */
  async function load() {
    if (cards.status !== "idle") return;
    setCards({ status: "loading" });

    try {
      const response = await fetch(`/api/sets/${encodeURIComponent(set.id)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
      setCards({ status: "ready", cards: (body as SetDetail).cards ?? [] });
    } catch (error) {
      setCards({
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue.",
      });
    }
  }

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
      onToggle={(event) => {
        if (event.currentTarget.open) void load();
      }}
    >
      <summary>
        {logo ? <img className="acc-logo" src={logo} alt="" /> : null}
        <span className="acc-title">{set.name}</span>
        <span className="acc-meta">{plural(set.cardCount.official, "carte")}</span>
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
              <p className="hint">Aucune carte ne correspond.</p>
            ) : (
              <div className="grid">
                {visible.map((card) => {
                  const src = imageUrl(card.image);
                  return (
                    <article className="card" key={card.id}>
                      <div className="frame">
                        {src ? (
                          <img
                            src={src}
                            alt={card.name}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                      </div>
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
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
