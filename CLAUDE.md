# MyCards — conventions

## Langue

**Tout se dit en français** : les réponses, mais aussi chaque message
intermédiaire entre deux étapes de travail (« je vérifie… », « c'est
corrigé… »), les messages de commit, les commentaires du code et la
documentation. Aucune exception, même pour une phrase courte.

## Réponses courtes

**Être bref.** Quelques lignes : ce qui a été fait, puis la question s'il y en
a une, mise en évidence. Pas de liste exhaustive des détails techniques.

## Décisions produit qui reviennent à l'utilisateur

**Ne jamais pousser une modification graphique ou ergonomique sans que
l'utilisateur ait tranché.** Proposer des options concrètes — de préférence
visibles, pas décrites — et attendre son choix. Cela vaut pour la
typographie, la palette, la hiérarchie de l'information, l'ajout ou le retrait
d'éléments d'interface.

Les corrections de bugs visuels (débordement, texte tronqué, contraste
illisible) ne sont pas concernées : elles se corrigent directement.

## Thème

**Sombre uniquement.** Pas de thème clair à maintenir, pas de
`prefers-color-scheme` à suivre. Les variables de `app/globals.css` portent
directement les valeurs sombres, et `:root` déclare `color-scheme: dark`.

## Règles techniques

- Les montants sont stockés et manipulés **en centimes**, jamais en flottant.
- Le schéma de base vit dans `lib/schema.ts` et s'applique depuis
  l'application. La base n'est joignable que par les fonctions serveur.
- `npm test` rejoue les requêtes de production contre un Postgres en mémoire.
  À lancer avant chaque commit touchant à la couche données.

## Publication

**Tout part directement sur `main`**, qui est déployée en production par
Vercel : l'utilisateur ne voit une modification qu'une fois en ligne. Pas de
branche de travail qui traîne, pas de pull request en attente de validation.
Les vérifications (`npm run typecheck`, `npm test`, `npm run build`) se font
avant le push, pas après.

## Relevés de cotes du scellé

Méthode, sources et adresses par produit : **`docs/releves-de-cotes.md`**.
Un relevé s'en tient au panel de sources qui y figure ; on n'en cherche pas
d'autres. Si une source change, on corrige ce fichier dans le même commit.
