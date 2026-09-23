/**
 * Schéma de l'inventaire — source unique de vérité.
 *
 * Il vit dans le code plutôt que dans un fichier .sql à part pour une raison
 * précise : l'app doit pouvoir l'appliquer elle-même depuis une fonction
 * serveur (voir `runMigrations`). Personne n'a à ouvrir un éditeur SQL, ni au
 * premier déploiement ni aux évolutions suivantes.
 *
 * Règle à tenir : chaque instruction doit être rejouable sans erreur sur une
 * base déjà à jour. `if not exists` partout, jamais de `drop`.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `create table if not exists items (
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

     -- Cote saisie à la main. Prioritaire sur la cote automatique.
     manual_value_cents   integer check (manual_value_cents >= 0),
     manual_value_date    date,

     notes                text,

     created_at           timestamptz not null default now(),
     updated_at           timestamptz not null default now()
   )`,

  // Image choisie à la main. Pour une carte identifiée, TCGdex fournit déjà
  // un visuel : ce champ ne sert qu'à le remplacer ou à couvrir le scellé,
  // que TCGdex ne référence pas.
  `alter table items add column if not exists image_url text`,

  // Un article visé et un article possédé sont le même objet à deux moments
  // de sa vie : un statut plutôt qu'une seconde table, et l'achat n'est
  // qu'une bascule qui préserve ce qui avait été saisi.
  `alter table items add column if not exists status text not null default 'owned'`,

  `create index if not exists items_status_idx on items (status)`,

  // Sous-type du scellé : blister, display, coffret… « Scellé » seul ne
  // permet pas de filtrer, et c'est justement ce qu'on veut faire.
  `alter table items add column if not exists sealed_type text`,

  `create index if not exists items_kind_idx on items (kind)`,

  `create index if not exists items_card_id_idx on items (card_id)
     where card_id is not null`,

  // Langue, état et gradation. Une PSA 10 ou une carte japonaise n'ont pas la
  // cote d'une carte française brute : sans ces champs, rien ne les distingue.
  // Tous facultatifs, validés côté application : la liste des valeurs admises
  // vit dans `lib/collection.ts` et doit pouvoir s'allonger sans migration.
  `alter table items add column if not exists language text`,
  `alter table items add column if not exists condition text`,
  `alter table items add column if not exists grader text`,
  `alter table items add column if not exists grade text`,

  // Essais de connexion ratés, pour ralentir qui devine le mot de passe.
  `create table if not exists login_failures (
     ip         text not null,
     failed_at  timestamptz not null default now()
   )`,

  `create index if not exists login_failures_ip_idx
     on login_failures (ip, failed_at)`,

  // Un relevé par jour de la valeur de l'inventaire, pour la courbe du
  // tableau de bord. La cote d'hier n'est disponible nulle part ailleurs :
  // ce qui n'est pas relevé le jour même est perdu.
  `create table if not exists value_snapshots (
     day                   date primary key,
     value_cents           bigint not null,
     purchase_cents        bigint not null,
     valued_purchase_cents bigint not null,
     unvalued_count        integer not null,
     recorded_at           timestamptz not null default now()
   )`,
];
