# MyCards

**En ligne :** https://my-cards-alpha.vercel.app

Suivi de collection Pokémon. Première étape : la collection anniversaire
**30 ans** affichée sur la page d'accueil, en français.

Deux écrans :

- **`/`** — la collection anniversaire **30 ans**, publique
- **`/collection`** — l'inventaire personnel, privé : articles possédés, prix
  d'achat, valeur actuelle et plus-value

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
idempotente dans `SCHEMA_STATEMENTS`, déployer, recliquer le bouton. Rien
n'est jamais supprimé, le rejeu est sans effet.

## Architecture

| Chemin                 | Rôle                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `app/page.tsx`         | Page d'accueil (statique)                                    |
| `app/set-gallery.tsx`  | Grille des cartes, chargée côté navigateur                   |
| `app/api/set/route.ts` | Route serveur : interroge TCGdex et met la réponse en cache  |
| `app/collection/`      | Inventaire : liste, totaux, formulaires, actions serveur      |
| `app/login/`           | Connexion par mot de passe                                    |
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

Le set « 30 ans » est résolu **par son nom** dans le catalogue TCGdex, pas par
un identifiant codé en dur. Pour forcer un set précis, définir la variable
d'environnement `TCGDEX_SET_ID`.

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
