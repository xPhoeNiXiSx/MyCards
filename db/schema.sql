-- Schéma de l'inventaire MyCards.
-- Idempotent : peut être rejoué sans risque sur une base existante.

create table if not exists items (
  id                   uuid primary key default gen_random_uuid(),

  -- 'single' = carte à l'unité (cote automatique via TCGdex)
  -- 'sealed' = produit scellé : ETB, display, coffret (cote saisie à la main)
  -- 'other'  = tout le reste
  kind                 text not null check (kind in ('single', 'sealed', 'other')),
  name                 text not null,

  -- Identifiant TCGdex de la carte, seul lien vers la cote automatique.
  card_id              text,
  set_name             text,

  quantity             integer not null default 1 check (quantity > 0),

  -- Montants en centimes d'euro : on ne stocke jamais d'argent en flottant.
  -- Prix d'achat unitaire, pas le total de la ligne.
  purchase_price_cents integer not null default 0 check (purchase_price_cents >= 0),
  purchase_date        date,

  -- Cote saisie à la main. Prioritaire sur la cote automatique quand elle existe.
  manual_value_cents   integer check (manual_value_cents >= 0),
  manual_value_date    date,

  notes                text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists items_kind_idx on items (kind);
create index if not exists items_card_id_idx on items (card_id) where card_id is not null;
