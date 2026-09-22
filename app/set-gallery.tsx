"use client";

import { useEffect, useMemo, useState } from "react";

import { assetUrl, imageUrl } from "@/lib/images";
import type { SetPayload } from "@/lib/tcgdex";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; payload: SetPayload };

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function SetGallery() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/set", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setState({ status: "ready", payload: body as SetPayload });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      });

    return () => controller.abort();
  }, []);

  const cards = state.status === "ready" ? state.payload.set.cards : [];

  // Le nom comme le numéro : on cherche « dracaufeu » aussi bien que « 042 ».
  const visible = useMemo(() => {
    const needle = normalize(search.trim());
    if (needle === "") return cards;
    return cards.filter(
      (card) =>
        normalize(card.name).includes(needle) ||
        card.localId.toLowerCase().includes(needle),
    );
  }, [cards, search]);

  if (state.status === "loading") {
    return (
      <>
        <div className="hero">
          <div>
            <h2>Chargement de la collection…</h2>
            <p className="facts">Récupération des cartes auprès de TCGdex.</p>
          </div>
        </div>
        <div className="grid">
          {Array.from({ length: 12 }, (_, index) => (
            <div className="card" key={index}>
              <div className="frame skeleton" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <div className="panel">
        <h2>La collection n&apos;a pas pu être chargée</h2>
        <p className="hint">
          {state.message} — l&apos;appel passe par <code>/api/set</code>, qui
          interroge <code>api.tcgdex.net</code>. Le détail de l&apos;erreur est
          aussi dans les logs de la fonction côté Vercel.
        </p>
      </div>
    );
  }

  const { set } = state.payload;
  const logo = assetUrl(set.logo);
  const released = formatDate(set.releaseDate);

  return (
    <>
      <div className="hero">
        {logo ? <img src={logo} alt="" /> : null}
        <div>
          <h2>{set.name}</h2>
          <ul className="facts">
            <li>
              <strong>{set.cardCount.official}</strong> cartes
            </li>
            {set.cardCount.total !== set.cardCount.official ? (
              <li>
                <strong>{set.cardCount.total}</strong> avec les secrètes
              </li>
            ) : null}
            {released ? <li>Sortie le {released}</li> : null}
            {set.serie ? <li>Série {set.serie.name}</li> : null}
          </ul>
        </div>
      </div>

      <div className="filter">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Chercher par nom ou numéro…"
          aria-label="Filtrer les cartes"
        />
        <span className="count">
          {visible.length === cards.length
            ? `${cards.length} cartes`
            : `${visible.length} sur ${cards.length}`}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="panel">
          <h2>Aucune carte ne correspond</h2>
          <p className="hint">
            Rien ne correspond à « {search} » dans cette collection.
          </p>
        </div>
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
  );
}
