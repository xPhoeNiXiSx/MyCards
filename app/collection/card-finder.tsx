"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { findByNumber, setIdOf } from "@/lib/card-number";
import { imageUrl } from "@/lib/images";
import { formatCents } from "@/lib/money";
import type { CardResume, SerieDetail, SetDetail } from "@/lib/tcgdex";

/** Ce que la recherche transmet au formulaire une fois la carte trouvée. */
export type PickedCard = {
  id: string;
  name: string;
  setName: string;
};

type Detail = {
  rarity: string | null;
  quoteCents: number | null;
};

type Props = {
  /** Sets déjà présents dans l'inventaire : proposés en premier. */
  ownedSetIds: string[];
  /** En modification, la carte déjà liée, pour pré-remplir la recherche. */
  initialCardId?: string | null;
  onPick: (card: PickedCard) => void;
};

/** Nombre de raccourcis d'extension. Le reste passe par la liste complète. */
const SHORTCUTS = 8;

/**
 * Retrouve une carte par son extension et le numéro imprimé dessus, plutôt
 * que par l'identifiant TCGdex que personne ne connaît de tête.
 *
 * Tout passe par les routes serveur existantes (`/api/series`,
 * `/api/sets/[id]`) : TCGdex n'est jamais appelé depuis le navigateur.
 */
export function CardFinder({ ownedSetIds, initialCardId, onPick }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [catalogue, setCatalogue] = useState<SerieDetail[] | null>(null);
  const [catalogueError, setCatalogueError] = useState(false);

  const [setId, setSetId] = useState(
    initialCardId ? (setIdOf(initialCardId) ?? "") : "",
  );
  const [number, setNumber] = useState(
    initialCardId && setIdOf(initialCardId)
      ? initialCardId.slice(initialCardId.lastIndexOf("-") + 1)
      : "",
  );

  const [cards, setCards] = useState<CardResume[] | null>(null);
  const [cardsError, setCardsError] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const cache = useRef(new Map<string, CardResume[]>());
  // La carte déjà liée ne doit pas écraser un nom retouché à la main : seule
  // une recherche faite par l'utilisateur remplit le formulaire.
  const lastPicked = useRef<string | null>(initialCardId ?? null);

  // Le catalogue n'est chargé que lorsque la recherche devient visible : le
  // formulaire d'ajout est monté dans une boîte fermée à chaque ouverture de
  // l'inventaire, et la plupart des visites n'ajoutent rien.
  useEffect(() => {
    const element = root.current;
    if (!element || catalogue) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      fetch("/api/series")
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data: SerieDetail[]) => setCatalogue(data))
        .catch(() => setCatalogueError(true));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [catalogue]);

  useEffect(() => {
    if (!setId) {
      setCards(null);
      return;
    }
    const known = cache.current.get(setId);
    if (known) {
      setCards(known);
      return;
    }

    let cancelled = false;
    setCards(null);
    setCardsError(false);
    fetch(`/api/sets/${encodeURIComponent(setId)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: SetDetail) => {
        if (cancelled) return;
        cache.current.set(setId, data.cards ?? []);
        setCards(data.cards ?? []);
      })
      .catch(() => !cancelled && setCardsError(true));
    return () => {
      cancelled = true;
    };
  }, [setId]);

  const sets = useMemo(
    () => (catalogue ?? []).flatMap((serie) => serie.sets),
    [catalogue],
  );
  const selected = sets.find((set) => set.id === setId);

  // Les extensions possédées d'abord, puis les plus récentes : c'est là que
  // tombent presque tous les ajouts.
  const shortcuts = useMemo(() => {
    const byId = new Map(sets.map((set) => [set.id, set]));
    const ids = [...new Set([...ownedSetIds, ...sets.map((set) => set.id)])];
    return ids
      .map((id) => byId.get(id))
      .filter((set) => set !== undefined)
      .slice(0, SHORTCUTS);
  }, [sets, ownedSetIds]);

  const match = cards && number.trim() ? findByNumber(cards, number) : undefined;

  useEffect(() => {
    if (!match || !selected) {
      setDetail(null);
      return;
    }
    if (lastPicked.current !== match.id) {
      lastPicked.current = match.id;
      onPick({ id: match.id, name: match.name, setName: selected.name });
    }

    let cancelled = false;
    setDetail(null);
    fetch(`/api/cards/${encodeURIComponent(match.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Detail) => !cancelled && setDetail(data))
      .catch(() => {
        // La rareté et la cote ne sont qu'un complément : la carte est déjà
        // identifiée, rien à signaler.
      });
    return () => {
      cancelled = true;
    };
  }, [match, selected, onPick]);

  return (
    <div className="finder" ref={root}>
      <div className="finder-field">
        <span className="finder-label">Extension</span>
        {catalogueError ? (
          <small className="error">
            Liste des extensions indisponible. L&apos;identifiant TCGdex
            ci-dessous reste utilisable.
          </small>
        ) : catalogue === null ? (
          <small>Chargement des extensions…</small>
        ) : (
          <>
            <div className="set-chips">
              {shortcuts.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className={set.id === setId ? "set-chip on" : "set-chip"}
                  aria-pressed={set.id === setId}
                  onClick={() => setSetId(set.id)}
                >
                  {set.name}
                </button>
              ))}
            </div>
            <select
              aria-label="Toutes les extensions"
              value={shortcuts.some((set) => set.id === setId) ? "" : setId}
              onChange={(event) => setSetId(event.target.value)}
            >
              <option value="">Autre extension…</option>
              {catalogue.map((serie) => (
                <optgroup key={serie.id} label={serie.name}>
                  {serie.sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </>
        )}
      </div>

      <label>
        Numéro sur la carte
        <span className="with-suffix">
          <input
            inputMode="text"
            autoComplete="off"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="015"
            disabled={!setId}
          />
          {selected ? (
            <span className="suffix">/ {selected.cardCount.official}</span>
          ) : null}
        </span>
      </label>

      {!setId ? null : cardsError ? (
        <small className="error">Cartes de l&apos;extension indisponibles.</small>
      ) : cards === null ? (
        <small>Chargement des cartes…</small>
      ) : match ? (
        <div className="found">
          {match.image ? (
            <img src={imageUrl(match.image, "low")} alt="" />
          ) : (
            <span className="found-empty" aria-hidden="true" />
          )}
          <div>
            <strong>{match.name}</strong>
            <small>
              {selected?.name} · {match.localId}/{selected?.cardCount.official}
            </small>
            {detail?.rarity ? <small>{detail.rarity}</small> : null}
            {detail ? (
              <span className="found-quote">
                {detail.quoteCents === null
                  ? "Pas encore cotée sur Cardmarket"
                  : `Cote Cardmarket ${formatCents(detail.quoteCents)}`}
              </span>
            ) : null}
          </div>
        </div>
      ) : number.trim() ? (
        <small>
          Aucune carte n° {number.trim()} dans {selected?.name ?? "cette extension"}.
        </small>
      ) : null}
    </div>
  );
}
