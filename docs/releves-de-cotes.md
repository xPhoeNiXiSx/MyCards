# Relevés de cotes du scellé

Les produits scellés n'ont pas de cote automatique (TCGdex ne les référence
pas). Leur valeur est relevée à la main, sur **les mêmes sources à chaque
fois**, puis posée en base par une migration de données
(`lib/data-migrations.ts`, voir plus bas).

Ce fichier fait référence : un relevé suit la méthode et les sources
ci-dessous, sans en chercher d'autres. Si une source disparaît ou ne couvre
plus un produit, on la remplace **ici**, dans le même commit que le relevé.

## Méthode

1. **Produit encore en rayon** (boosters, blisters, tripacks, coffrets) :
   cote = **médiane** des prix affichés par les revendeurs du panel. Un prix
   isolé, haut ou bas, ne fait pas la cote. Les produits en rupture chez un
   revendeur sont ignorés pour ce revendeur.
2. **Produit en rupture partout** : cote = **médiane des prix affichés**
   malgré la rupture. Cardmarket, qui refuse la lecture automatique, n'est
   plus consulté.
3. Pièges déjà rencontrés :
   - Cardmarket mélange les langues : vérifier qu'il s'agit bien de la
     **version française** (`?language=2` dans l'adresse ; `language=1` est
     l'anglais).
   - L'**ETB Pokémon Center** est un autre produit que l'ETB classique, deux
     fois plus cher. Ne jamais prendre l'un pour l'autre.
   - Un « blister 3 boosters » n'est pas un blister à l'unité.
4. Arrondir au centime, en centimes dans le code (`cents: 1990`).

## Panel de sources

Toujours les mêmes, dans cet ordre de priorité. Depuis le 11/10/2026, on
s'en tient aux revendeurs que le bouton « Mettre à jour les prix » arrive
à lire : Cultura, Pokelite, Les Gentlemen du Jeu, Chocobonplan et
Cardmarket ont été retirés, car ils ne donnaient aucun prix lisible ou
refusaient la lecture.

| Rôle | Site | Pourquoi |
|---|---|---|
| Revendeur | [pokezenith.com](https://www.pokezenith.com) | Large catalogue scellé FR, prix lus sans souci |
| Revendeur | [blazingtail.fr](https://www.blazingtail.fr) | Tripacks et blisters de toutes les séries |
| Revendeur | [pokestock.fr](https://pokestock.fr) · [hamacards.com](https://www.hamacards.com) | Blisters ME01 |
| Revendeur | [lecoindesbarons.com](https://lecoindesbarons.com) | Blister ME05 |

## Adresses par produit

Les produits actuellement suivis, avec l'adresse à consulter en premier.

| Produit (nom dans l'inventaire) | Source de référence |
|---|---|
| ETB 30 ans | [Pokézenith — ETB ME05.5 30e Anniversaire](https://www.pokezenith.com/me055-30e-anniversaire/459-pokemon-coffret-dresseur-d-elite-etb-me055-30e-anniversaire-196214144835.html) |
| Coffret Ronflex et Leuphorie | [Pokézenith](https://www.pokezenith.com/coffrets-boites-speciales/364-pokemon-coffret-collection-speciale-ronflex-ex-leuphorie-ex-0196214129788.html) |
| Coffret Mewtwo Ex de la Team Rocket | [Pokézenith](https://www.pokezenith.com/coffrets-boites-speciales/73-pokemon-coffret-mewtwo-ex-de-la-team-rocket-0196214109391.html) |
| Coffret Méga-Kangourex Ex | [Pokézenith](https://www.pokezenith.com/coffrets-boites-speciales/259-pokemon-coffret-mega-kangourex-ex-0196214116870.html) |
| Tripack ME01 | [Blazingtail](https://www.blazingtail.fr/69068-tripack-pokemon-mega-evolution-me01.html) |
| Tripack ME05 Nuit noire | [Blazingtail](https://www.blazingtail.fr/80477-tripack-pokemon-nuit-noire-me05.html) · [Pokézenith](https://www.pokezenith.com/me05-nuit-noire/427-pokemon-tripack-me05-nuit-noire-196214142411.html) |
| Bundle Nuit Noire | Aucune fiche trouvée sur le panel : à saisir à la main |
| Blister ME01 | [Pokestock](https://pokestock.fr/produit/booster-blister-me01-pokemon/) · [Hamacards](https://www.hamacards.com/produit/blister-pokemon-mega-evolution-me01/) |
| Blister ME04 Chaos Ascendant | [Blazingtail](https://www.blazingtail.fr/77320-blister-pokemon-chaos-ascendant-me04.html) |
| Blister ME05 Nuit noire | [Le Coin des Barons](https://lecoindesbarons.com/tradingcard-game/cartes-pokemon/booster-pokemon/pokemon-blister-nuit-noire-me05-en-francais/) |
| Blister EV10 Rivalités Destinées | [Blazingtail](https://www.blazingtail.fr/68215-blister-pokemon-ev10-rivalites-destinees.html) |
| Booster Évolution Prismatique | Aucune fiche du booster seul sur le panel : à saisir à la main |
| Booster Rivalité Destinées | [Pokézenith](https://www.pokezenith.com/ev10-rivalites-destinees/74-pokemon-booster-ev10-rivalites-destinees-0196214111028.html) |
| Booster Aventures Ensemble | Aucune fiche du booster seul sur le panel : à saisir à la main |

Un nouveau produit scellé dans l'inventaire : l'ajouter à ce tableau, avec son
nom **exact** tel qu'il apparaît dans l'inventaire (c'est le seul point
d'accroche de la migration) et une adresse sur un site du panel.

Un relevé vise les types « Scellé » **et** « Autre » (passer
`["sealed", "other"]` à `fillSealedQuotes`) : un produit rangé en « Autre »
partage l'écran du scellé et ne doit pas rester sans cote.

## Bouton « Mettre à jour les prix » (page Compte)

Le bouton applique cette méthode tout seul, sur ces mêmes adresses : elles
sont recopiées dans **`lib/sealed-prices.ts`** (`SEALED_PRODUCTS`). Un
produit ajouté ou une adresse changée ici doit l'être là aussi, dans le même
commit.

- Les sites refusent les requêtes venues des serveurs de Vercel (403). Les
  pages passent donc par **ScraperAPI** quand la variable `SCRAPER_API_KEY`
  est définie dans Vercel (offre gratuite : 1 000 pages par mois).
- Revendeurs : prix et stock lus dans les données produit de la page
  (JSON-LD schema.org, sinon balises meta), médiane des revendeurs en stock.
- Cardmarket n'est plus interrogé.
- Tous les revendeurs en rupture : médiane des prix
  qu'ils affichent malgré tout, plutôt que pas de cote. Le site bloque souvent les robots ; un produit qui n'a que cette
  source reste alors à relever à la main, comme avant.
- Le produit est reconnu dans l'inventaire par deux motifs (objet et
  extension) plutôt que par son nom exact.
- Seules les cotes vides ou posées par un relevé sont remplacées ; une cote
  saisie dans l'application ne l'est jamais. Le compte rendu s'affiche sous
  le bouton, produit par produit, avec la raison de chaque échec.

## Accès depuis une session Claude Code

Dans l'environnement cloud actuel, ces sites ne sont **pas joignables
directement** : la politique réseau ne laisse passer que la recherche. Deux
façons de s'en tenir au panel :

- **Recherche restreinte** (fonctionne aujourd'hui) : `WebSearch` avec
  `allowed_domains` limité aux domaines du panel ci-dessus, un produit par
  recherche.
- **Lecture directe** (mieux) : ajouter les domaines du panel aux domaines
  autorisés du réseau de l'environnement. Les adresses ci-dessus se lisent
  alors telles quelles, sans passer par un moteur de recherche.

## Poser un relevé

1. Ajouter une liste `SEALED_QUOTES_AAAA_MM_JJ` dans `lib/data-migrations.ts`
   et une entrée `DATA_MIGRATIONS` avec un identifiant **nouveau**
   (`AAAA-MM-JJ-cotes-scelle`). Ne jamais modifier une migration déjà jouée.
2. Mettre à jour les attentes de `scripts/test-db.ts` (les tests vérifient
   l'état après *toutes* les migrations), lancer `npm test`.
3. Pousser sur `main`, puis **Compte → Appliquer les migrations** dans l'app.
   La page indique combien d'articles ont été touchés.

Un relevé ne remplace jamais une cote saisie dans l'application : il ne
remplit que les cotes vides et rafraîchit celles posées par un relevé
précédent.

## Historique

| Date | Produits | Notes |
|---|---|---|
| 25/09/2026 | 6 | Prix publics ; l'ETB n'avait pas été trouvé (libellé exact) |
| 26/09/2026 | 7 | Libellés lus dans l'inventaire ; ETB retrouvé par description |
| 02/10/2026 | 12 | Médiane revendeurs ; ETB au plus bas Cardmarket VF (165 €) |
| 02/10/2026 | 1 | Bundle Nuit Noire (38,99 €), oublié des relevés précédents ; vise aussi le type « Autre » |
