# MyCards

**En ligne :** https://my-cards-alpha.vercel.app

Suivi de collection Pokémon, en français : ce qu'on possède, ce que ça a
coûté, ce que ça vaut, et ce qu'on cherche encore.

**L'application entière est privée.** Toute route autre que la page de
connexion redirige vers celle-ci tant que la session n'est pas ouverte — la
galerie et les routes API comprises. La fermeture se fait dans `proxy.ts`,
en amont du rendu, pour qu'une route ajoutée plus tard soit fermée par défaut
plutôt que publique par oubli.

La connexion est freinée : au-delà de 5 mots de passe faux en 15 minutes
depuis une même adresse, elle est refusée jusqu'à la fin de la fenêtre
(`lib/throttle.ts`). Les échecs sont comptés en base, une fonction serverless
ne gardant rien en mémoire d'un appel à l'autre, et par adresse, pour qu'un
inconnu ne puisse pas bloquer le propriétaire en échouant exprès.

Quatre écrans :

- **`/`** — le tableau de bord : valeur, plus-value, indicateurs, répartition
- **`/catalogue`** — toutes les séries Pokémon et leurs collections
- **`/collection`** — l'inventaire : articles possédés, prix d'achat, valeur
  actuelle et plus-value
- **`/liste`** — les articles visés, et le passage à l'achat

## Design

**Thème sombre uniquement** : pas de variante claire, pas de
`prefers-color-scheme` à suivre, `:root` déclare `color-scheme: dark`.
L'accent terracotta est réservé à la marque et aux repères actifs. Deux familles via `next/font` — **Inter** pour le texte,
**Space Grotesk** pour les titres et tous les montants, parce que les chiffres
sont le sujet de l'application.

Tout est piloté par des variables CSS dans `app/globals.css`, qui portent
directement les valeurs sombres. `--font-body` et `--font-display` ont un repli déclaré dans
`:root` : une `font-family` construite sur une variable absente est invalide
*en entier* et ferait retomber la page en serif.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Postgres** (Neon) pour l'inventaire
- Données cartes et cotes : [TCGdex](https://tcgdex.dev) — gratuit, sans clé, locale `fr`

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
npm run typecheck  # tsc --noEmit
npm test           # couche données, sur un Postgres en mémoire (PGlite)
```

Les tests appliquent le vrai schéma, par le même code que la production, et
rejouent les requêtes réelles contre un Postgres embarqué : seul le pilote
change. Pas besoin de base ni de réseau pour les lancer.

## Configuration

Trois variables d'environnement, à définir dans Vercel (Settings →
Environment Variables) et dans un `.env.local` pour le développement :

| Variable        | Rôle                                                        |
| --------------- | ----------------------------------------------------------- |
| `DATABASE_URL`  | Chaîne de connexion Postgres (Neon)                          |
| `APP_PASSWORD`  | Mot de passe unique d'accès à l'inventaire                   |
| `AUTH_SECRET`   | Clé de signature du cookie de session — une valeur aléatoire |

Tant qu'elles manquent, `/collection` affiche un écran expliquant ce qui
manque plutôt que de planter. La page d'accueil, elle, n'en dépend pas.

Générer un secret : `openssl rand -base64 32`.

### Créer la base

1. Vercel → onglet **Storage** → **Create Database** → **Neon** (offre gratuite)
2. Vercel injecte `DATABASE_URL` dans le projet
3. Redéployer, se connecter, puis cliquer **Initialiser la base** sur
   `/collection`

Aucun SQL à exécuter à la main. Le schéma vit dans `lib/schema.ts` et l'app
l'applique elle-même, parce que la base n'est joignable que depuis les
fonctions serveur — ni depuis un poste de développement, ni depuis un agent.

Même mécanique pour les évolutions futures : ajouter une instruction
idempotente dans `SCHEMA_STATEMENTS`, déployer, puis lancer **Appliquer les
migrations** depuis la page **Mon compte**. Rien n'est jamais supprimé, le
rejeu est sans effet.

## Architecture

| Chemin                 | Rôle                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `app/page.tsx`         | Tableau de bord : valeur, plus-value, répartition             |
| `app/catalogue/`       | Le catalogue des collections                                  |
| `app/db-screens.tsx`   | Écrans d'attente de la base, partagés par les pages qui la lisent |
| `app/series-browser.tsx` | Catalogue en accordéon, cartes chargées à l'ouverture        |
| `app/card-viewer.tsx`  | Visionneuse plein écran, navigation carte à carte             |
| `app/api/series/route.ts` | Catalogue : séries et leurs collections                    |
| `app/api/sets/[id]/route.ts` | Cartes d'une collection                                |
| `app/collection/`      | Inventaire : liste, totaux, formulaires, actions serveur      |
| `app/liste/`           | Liste d'achats : articles visés, bascule à l'achat             |
| `app/compte/`          | Compte : session, déconnexion, futurs réglages                 |
| `app/tab-bar.tsx`      | Barre d'onglets fixée en bas, icônes seules                    |
| `app/wordmark.tsx`     | Logotype, en `currentColor` — la teinte se règle en CSS        |
| `app/icon.svg`         | Favicon                                                       |
| `app/login/`           | Connexion par mot de passe                                    |
| `proxy.ts`             | Ferme toute l'application derrière la session                  |
| `lib/session.ts`       | Signature et vérification du cookie, sans `next/headers`      |
| `lib/tcgdex.ts`        | Client TCGdex — serveur uniquement                           |
| `lib/images.ts`        | Construction des URL d'images — utilisable côté navigateur   |
| `lib/collection.ts`    | CRUD de l'inventaire et calcul des plus-values                |
| `lib/pricing.ts`       | Lecture des cotes Cardmarket exposées par TCGdex              |
| `lib/money.ts`         | Montants en centimes, formatage et saisie en euros            |
| `lib/auth.ts`          | Session par mot de passe unique                               |
| `lib/throttle.ts`      | Limite des essais de connexion, par adresse                   |
| `lib/schema.ts`        | Schéma Postgres, idempotent, appliqué par l'app elle-même      |

L'appel à TCGdex passe par une route serveur plutôt que directement depuis le
navigateur : pas de dépendance au CORS, une seule réponse mise en cache (1 h)
pour tous les visiteurs, et c'est le point d'accroche naturel pour le suivi des
cotes à venir.

Le catalogue est un accordéon à deux niveaux — série, puis collection, puis
cartes. Rien n'est chargé tant qu'une collection n'est pas ouverte : il y a
environ 150 collections et plusieurs dizaines de milliers de cartes. Une
collection déjà ouverte garde ses cartes en mémoire, la refermer et la rouvrir
ne redemande rien.

TCGdex ne donne pas les collections dans la liste des séries : le catalogue
fait une requête par série, en parallèle, mise en cache une heure côté
serveur.

**Filtre par rareté** — la liste des cartes d'un set ne porte pas la rareté,
et `/sets/{id}` ignore les paramètres de filtre. C'est `/cards` qui sait
filtrer, et il accepte `set` et `rarity` ensemble : le filtre passe donc par
`/cards?set=eq:<set>&rarity=eq:<rareté>`. Les 42 raretés viennent de
`/rarities`.

Le filtre masque les collections qui ne contiennent aucune carte de la rareté
choisie, et les séries qui s'en trouvent vidées. Une seule requête suffit :
`/cards?rarity=eq:X` renvoie les cartes de cette rareté tous sets confondus,
et leur identifiant est préfixé du set. Le regroupement se fait côté serveur,
pour n'envoyer au navigateur qu'une poignée de compteurs au lieu de milliers
de cartes.

## Application sur mobile

`app/manifest.ts` déclare `display: standalone` : posée sur l'écran d'accueil
iOS, l'application s'ouvre sans la barre d'adresse et la navigation y reste.
Next émet la balise standardisée `mobile-web-app-capable` ; la variante
préfixée `apple-` est ajoutée à la main pour les iOS antérieurs à 16.4.

Les champs de saisie sont à 16 px, pas moins : en dessous, iOS zoome à la mise
au point et ce zoom fait défiler la page horizontalement.

Le manifeste et les icônes sont exclus du filtre de session : iOS les récupère
au moment de l'ajout à l'écran d'accueil.

## Déploiement

Les fonctions serveur sont épinglées sur **Francfort** (`fra1`, voir
`vercel.json`), la même région que la base Neon. Sans ça elles tourneraient à
Washington par défaut et chaque requête SQL ferait un aller-retour
transatlantique. Les données ne quittent pas l'UE.

Le repo est connecté à Vercel via l'intégration GitHub. Aucune commande
manuelle :

- push sur `main` → déploiement en production
- push sur une autre branche → URL de preview dédiée
- pull request → Vercel commente la PR avec le lien de preview

## Liste d'achats

Un article visé et un article possédé sont le même objet à deux moments de sa
vie : une seule table `items`, distinguée par `status` (`owned` / `wanted`).
L'achat n'est donc qu'une bascule qui renseigne le prix payé et la date — rien
n'est ressaisi, et l'identifiant comme le visuel suivent la ligne.

Une ligne visée ne porte que le nécessaire : type, nom, et l'identifiant
TCGdex pour une carte. Le prix d'achat et la valeur n'existent pas encore.
Les cartes visées affichent tout de même leur cote du jour, puisque c'est ce
qu'on veut savoir avant d'acheter.

## Types de scellé

Un article scellé porte un sous-type — blister, tripack, display, coffret
dresseur d'élite… — qui sert de libellé dans la liste. Avec les cartes, ces
sous-types forment les **catégories**, présentées en puces de filtre au-dessus
de l'inventaire et rappelées par une pastille de couleur sur chaque ligne.

Filtre et vue passent par l'URL (`?type=blister&vue=images`) : la page est
rendue côté serveur, donc une liste filtrée reste partageable et le bouton
retour fonctionne. Seules les catégories réellement présentes sont proposées,
et le filtre porte aussi sur les totaux — un total qui ne correspondrait pas
aux lignes affichées en dessous ne voudrait rien dire.

Deux vues : **liste** (avec les montants) et **images** (les visuels seuls,
trois colonnes sur mobile, quantité en pastille).

### Couleurs de catégorie

Palette catégorielle validée sur le fond sombre de l'application : bande de
luminosité, saturation, séparation en vision déficiente (ΔE 8,4 au pire) et
contraste. Les teintes sont attribuées dans un **ordre fixe** et ne tournent
jamais — une catégorie garde sa couleur quel que soit le filtre actif.
Au-delà de huit catégories, aucune neuvième teinte n'est fabriquée : « Autre »
prend un gris neutre. La couleur ne porte jamais l'information seule, chaque
puce étant nommée.

Le sous-type ne vaut que pour le scellé : il est effacé si l'article change de
type.

## Regroupement

L'inventaire affiche une ligne par produit : les achats d'un même article sont
regroupés, avec la quantité cumulée, le total dépensé et le prix unitaire
moyen pondéré. Les achats individuels restent listés sous le nom et chacun
ouvre sa fiche — deux achats à des dates ou des prix différents ne doivent pas
disparaître dans une moyenne.

Le regroupement se fait sur le type, l'identifiant TCGdex, la langue, la
gradation et le nom normalisé
(accents, casse et espaces ignorés). L'identifiant prime : deux cartes
homonymes de sets différents restent distinctes.

## Valorisation

Les montants sont stockés **en centimes**, jamais en flottant.

- **Cartes à l'unité** — renseigner l'identifiant TCGdex sur la ligne suffit :
  la cote Cardmarket en euros est récupérée automatiquement et mise en cache
  une heure.
- **Scellé et divers** — la valeur actuelle est saisie à la main, avec sa date
  de relevé. TCGdex ne couvre pas les produits scellés.

**Visuels** — une carte identifiée affiche celui de TCGdex sans rien saisir.
Le scellé n'étant pas référencé par TCGdex, son image se renseigne par une
adresse, dans le formulaire. Une adresse saisie prime toujours sur le visuel
automatique, et seuls `http` et `https` sont acceptés : le champ finit dans le
`src` d'une balise `img`.

Une valeur saisie à la main est toujours prioritaire sur la cote automatique.
Une ligne sans valeur connue est comptée comme non valorisée plutôt que comme
valant zéro.

`lib/pricing.ts` lit l'objet `cardmarket` de TCGdex, plat et en euros, et
retient le premier prix disponible dans l'ordre `trend`, `avg7`, `avg30`,
`avg`, `avg1`, `low`. `trend` est la référence de marché de Cardmarket : plus
stable qu'un prix bas isolé, plus réactif qu'une moyenne 30 jours. Les
variantes holo (`trend-holo`…) ne servent qu'à défaut de valeur standard, et
une devise autre que l'euro est refusée plutôt que convertie en silence.

**Le set anniversaire n'est pas encore coté** : au 22 septembre 2026, aucune
de ses cartes n'a de prix Cardmarket (`cardmarket: null`), le set ayant six
jours. Les cotes apparaîtront d'elles-mêmes, sans changement de code. En
attendant, ces cartes se valorisent à la main comme le scellé.

### Retrouver une carte

Pour une carte à l'unité, le formulaire propose de choisir l'extension (celles
déjà présentes dans l'inventaire d'abord, puis les plus récentes, et la liste
complète en dessous), puis de taper le numéro imprimé sur la carte. « 15 »,
« 015 » et « 015/165 » désignent la même carte. La carte trouvée remplit le
nom, l'identifiant TCGdex et l'extension, qui restent modifiables, et affiche
sa rareté et sa cote. Tout passe par les routes serveur (`/api/series`,
`/api/sets/[id]`, `/api/cards/[id]`) : TCGdex n'est jamais appelé depuis le
navigateur.

### Langue, état, gradation

Facultatifs, dans « Plus d'options » du formulaire. La langue vaut pour tout
article (français par défaut), l'état (échelle Cardmarket, Mint à Poor) et la
gradation (PSA, PCA, CGC, BGS, SGC, Collect Aura, note de 1 à 10 par
demi-points) pour les cartes seulement. Gradée, une carte n'a plus d'état :
sa note le remplace.

**Une carte gradée ne reprend jamais la cote automatique** : Cardmarket cote
la carte brute, et l'appliquer à une PSA 10 la sous-évaluerait sans le dire.
Sans valeur saisie, elle reste non valorisée, ce qui se voit.

Dans l'inventaire, ces informations s'affichent en pastilles après le nom :
dorée pour la note (« PSA 10 »), neutres pour la langue (« JP », jamais pour
le français) et l'état (« NM »). En galerie, note et langue passent sous
l'image, qui reste intacte.

Langue et gradation font partie de la clé de regroupement : une japonaise et
une française, ou une gradée et la même brute, sont deux produits. L'état,
non : s'il diffère d'un achat à l'autre, il n'est pas affiché sur le groupe.

## Suite

- Historique de valorisation, pour suivre l'évolution dans le temps
- Automatiser la cote du scellé via une API tierce
- Ajouter un article directement depuis la galerie d'accueil
