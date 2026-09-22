"use client";

import { useEffect, useState } from "react";

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

export function SetGallery() {
  const [state, setState] = useState<State>({ status: "loading" });

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
      <div className="notice">
        <h3>La collection n&apos;a pas pu être chargée</h3>
        <p>
          {state.message} — l&apos;appel passe par <code>/api/set</code>, qui
          interroge <code>api.tcgdex.net</code>. Le détail de l&apos;erreur est
          aussi dans les logs de la fonction côté Vercel.
        </p>
      </div>
    );
  }

  const { set, companion } = state.payload;
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
              <strong>{set.cardCount.official}</strong> cartes officielles
            </li>
            {set.cardCount.total !== set.cardCount.official ? (
              <li>
                <strong>{set.cardCount.total}</strong> avec les secrètes
              </li>
            ) : null}
            {released ? (
              <li>
                Sortie le <strong>{released}</strong>
              </li>
            ) : null}
            {set.serie ? (
              <li>
                Série <strong>{set.serie.name}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="grid">
        {set.cards.map((card) => {
          const src = imageUrl(card.image);
          return (
            <article className="card" key={card.id}>
              <div className="frame">
                {src ? (
                  <img src={src} alt={card.name} loading="lazy" decoding="async" />
                ) : null}
              </div>
              <span className="name" title={card.name}>
                {card.name}
              </span>
              <span className="num">
                {card.localId} / {set.cardCount.official}
              </span>
            </article>
          );
        })}
      </div>

      {companion ? (
        <div className="notice">
          <h3>{companion.name}</h3>
          <p>
            La sous-collection anniversaire ({companion.cardCount.official}{" "}
            cartes) existe aussi chez TCGdex sous l&apos;identifiant{" "}
            <code>{companion.id}</code>. Elle n&apos;est pas encore affichée
            ici.
          </p>
        </div>
      ) : null}
    </>
  );
}
