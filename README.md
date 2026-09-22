# MyCards

**En ligne :** https://my-cards-alpha.vercel.app

Suivi de collection Pokémon. Première étape : la collection anniversaire
**30 ans** affichée sur la page d'accueil, en français.

**L'application entière est privée.** Toute route autre que la page de
connexion redirige vers celle-ci tant que la session n'est pas ouverte — la
galerie et les routes API comprises. La fermeture se fait dans `proxy.ts`,
en amont du rendu, pour qu'une route ajoutée plus tard soit fermée par défaut
plutôt que publique par oubli.

Deux écrans :

- **`/`** — le catalogue complet : toutes les séries et leurs collections
- **`/collection`** — l'inventaire : articles possédés, prix d'achat, valeur
  actuelle et plus-value

## Design

Direction « papier chaud et encre » : le mode clair évoque le carton d'une
carte, le mode sombre l'encre. L'accent terracotta est réservé à la marque et
aux repères actifs. Deux familles via `next/font` — **Inter** pour le texte,
**Space Grotesk** pour les titres et tous les montants, parce que les chiffres
sont le sujet de l'application.

Tout est piloté par des variables CSS dans `app/globals.css`, redéfinies pour
le thème sombre. `--font-body` et `--font-display` ont un repli déclaré dans
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
| `app/page.tsx`         | Page d'accueil (statique)                                    |
| `app/series-browser.tsx` | Catalogue en accordéon, cartes chargées à l'ouverture        |
| `app/api/series/route.ts` | Catalogue : séries et leurs collections                    |
| `app/api/sets/[id]/route.ts` | Cartes d'une collection                                |
| `app/collection/`      | Inventaire : liste, totaux, formulaires, actions serveur      |
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

Deux routes de diagnostic :

- `/api/debug/pricing` — une carte du set, son `pricing` brut et ce qui en est lu
- `/api/debug/prices` — combien de cartes d'un set portent réellement une cote

## Suite

- Historique de valorisation, pour suivre l'évolution dans le temps
- Automatiser la cote du scellé via une API tierce
- Ajouter un article directement depuis la galerie d'accueil
