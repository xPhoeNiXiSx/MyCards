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
2. **Produit en rupture partout** (typiquement un ETB dans les semaines qui
   suivent sa sortie) : cote = **plus bas prix Cardmarket en version
   française**. Le prix conseillé ne dit plus ce que vaut le produit.
3. Pièges déjà rencontrés :
   - Cardmarket mélange les langues : vérifier qu'il s'agit bien de la
     **version française** (`?language=2` dans l'adresse ; `language=1` est
     l'anglais).
   - L'**ETB Pokémon Center** est un autre produit que l'ETB classique, deux
     fois plus cher. Ne jamais prendre l'un pour l'autre.
   - Un « blister 3 boosters » n'est pas un blister à l'unité.
4. Arrondir au centime, en centimes dans le code (`cents: 1990`).

## Panel de sources

Toujours les mêmes, dans cet ordre de priorité.

| Rôle | Site | Pourquoi |
|---|---|---|
| Marché (rupture, revente) | [cardmarket.com](https://www.cardmarket.com/fr/Pokemon) | La référence européenne, prix réels de revente |
| Revendeur | [pokezenith.com](https://www.pokezenith.com) | Large catalogue scellé FR, prix à jour |
| Revendeur | [lesgentlemendujeu.com](https://lesgentlemendujeu.com) | Couvre boosters à l'unité et coffrets |
| Revendeur | [blazingtail.fr](https://www.blazingtail.fr) | Tripacks et blisters de toutes les séries |
| Revendeur | [pokelite.fr](https://www.pokelite.fr) | Suivi des restocks, prix constatés |
| Revendeur | [cultura.com](https://www.cultura.com) | Grande surface : le prix public de référence |
| Comparateur | [chocobonplan.com](https://chocobonplan.com) | Agrège plusieurs boutiques en une page |

## Adresses par produit

Les produits actuellement suivis, avec l'adresse à consulter en premier.

| Produit (nom dans l'inventaire) | Source de référence |
|---|---|
| ETB 30 ans | [Cardmarket — ETB 30th Celebration (VF)](https://www.cardmarket.com/fr/Pokemon/Products/Elite-Trainer-Boxes/30th-Celebration-Elite-Trainer-Box?language=2) |
| Coffret Mewtwo Ex de la Team Rocket | [Pokézenith](https://www.pokezenith.com/coffrets-boites-speciales/73-pokemon-coffret-mewtwo-ex-de-la-team-rocket-0196214109391.html) |
| Coffret Méga-Kangourex Ex | [Pokézenith](https://www.pokezenith.com/coffrets-boites-speciales/259-pokemon-coffret-mega-kangourex-ex-0196214116870.html) · [Chocobonplan](https://chocobonplan.com/bons-plans/cartes-a-jouer/cartes-pokemon/coffret-mega-kangourex-ex) |
| Tripack ME01 | [Blazingtail](https://www.blazingtail.fr/69068-tripack-pokemon-mega-evolution-me01.html) |
| Tripack ME05 Nuit noire | [Blazingtail](https://www.blazingtail.fr/80477-tripack-pokemon-nuit-noire-me05.html) · [Les Gentlemen du Jeu](https://lesgentlemendujeu.com/pokemon-me05-nuit-noire/12348-pokemon-me05-tripack-nuit-noire-0196214142411.html) |
| Blister ME01 | [Pokestock](https://pokestock.fr/produit/booster-blister-me01-pokemon/) · [Hamacards](https://www.hamacards.com/produit/blister-pokemon-mega-evolution-me01/) |
| Blister ME04 Chaos Ascendant | [Blazingtail](https://www.blazingtail.fr/77320-blister-pokemon-chaos-ascendant-me04.html) |
| Blister ME05 Nuit noire | [Le Coin des Barons](https://lecoindesbarons.com/tradingcard-game/cartes-pokemon/booster-pokemon/pokemon-blister-nuit-noire-me05-en-francais/) |
| Blister EV10 Rivalités Destinées | [Pokelite](https://www.pokelite.fr/produit/blister-rivalites-destinees-pokemon-ev10/) |
| Booster Évolution Prismatique | [Cardmarket — booster (VF)](https://www.cardmarket.com/fr/Pokemon/Products/Boosters/Prismatic-Evolutions-Booster?language=2) |
| Booster Rivalité Destinées | [Cultura](https://www.cultura.com/p-booster-pokemon-ev10-ecarlate-et-violet-rivalites-destinees-12763471.html) · [Pokézenith](https://www.pokezenith.com/ev10-rivalites-destinees/74-pokemon-booster-ev10-rivalites-destinees-0196214111028.html) |
| Booster Aventures Ensemble | [Les Gentlemen du Jeu](https://lesgentlemendujeu.com/pokemon-ev09-aventures-ensemble/8668-pokemon-ev09-boosters-aventures-ensemble-0196214107984.html) · [Cultura](https://www.cultura.com/p-booster-ev09-aventures-ensemble-pokemon-modeles-aleatoires-vendu-a-l-unite-11793678.html) |

Un nouveau produit scellé dans l'inventaire : l'ajouter à ce tableau, avec son
nom **exact** tel qu'il apparaît dans l'inventaire (c'est le seul point
d'accroche de la migration) et une adresse sur un site du panel.

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
