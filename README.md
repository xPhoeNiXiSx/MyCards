# MyCards

**En ligne :** https://my-cards-alpha.vercel.app

Suivi de collection Pokémon. Première étape : la collection anniversaire
**30 ans** affichée sur la page d'accueil, en français.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- Aucune dépendance runtime au-delà du framework
- Données : [TCGdex](https://tcgdex.dev) — API gratuite, sans clé, locale `fr`

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
npm run typecheck  # tsc --noEmit
```

## Architecture

| Chemin                 | Rôle                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `app/page.tsx`         | Page d'accueil (statique)                                    |
| `app/set-gallery.tsx`  | Grille des cartes, chargée côté navigateur                   |
| `app/api/set/route.ts` | Route serveur : interroge TCGdex et met la réponse en cache  |
| `lib/tcgdex.ts`        | Client TCGdex — serveur uniquement                           |
| `lib/images.ts`        | Construction des URL d'images — utilisable côté navigateur   |

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

## Suite

- Inventaire personnel : cartes à l'unité, ETB et autres produits scellés
- Prix d'achat et cote actuelle, avec la plus-value par article
