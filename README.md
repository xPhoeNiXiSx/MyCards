# MyCards

**En ligne :** https://my-cards-alpha.vercel.app

Suivi de collection Pokémon. Première étape : la collection anniversaire
**30 ans** affichée sur la page d'accueil, en français.

Deux écrans :

- **`/`** — la collection anniversaire **30 ans**, publique
- **`/collection`** — l'inventaire personnel, privé : articles possédés, prix
  d'achat, valeur actuelle et plus-value

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

La forme exacte du champ `pricing` de TCGdex n'est pas encore figée, donc
`lib/pricing.ts` parcourt l'objet et retient la première valeur numérique
correspondant à une notion de prix connue, tendance d'abord. La route
`/api/debug/pricing?id=<carte>` renvoie le payload brut à côté de ce qui en est
extrait, pour resserrer ce lecteur.

## Suite

- Historique de valorisation, pour suivre l'évolution dans le temps
- Automatiser la cote du scellé via une API tierce
- Ajouter un article directement depuis la galerie d'accueil
