# Gates qualité et release V4.1

## Autorité et objectif

- Ticket : `V4.1-007`, puis exécution finale par `V4.1-501` et `V4.1-502`.
- Baseline produit : V4 released au SHA
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9`.
- Budget initial : 125 000 octets JS gzip et 25 000 octets CSS gzip.
- Couverture de release : statements, branches, functions et lines à 80 %
  minimum ; lignes à 90 % minimum dans chaque domaine critique.
- Sécurité : aucun avis applicable `high` ou `critical`.

Les seuils de release sont fixes. Une mesure rouge décrit le travail restant ;
elle n'autorise ni réduction du seuil, ni exclusion opportuniste de fichiers.

## Deux modes, deux responsabilités

`pnpm quality:v4.1:baseline` doit rester vert pendant la migration. Il exécute
les contrôles reproductibles et **rapporte** les écarts de couverture encore
ouverts. Il empêche une migration de masquer un défaut technique sans prétendre
que V4.1 est déjà publiable.

`pnpm quality:v4.1:final` est le gate de release. Il bloque si une des quatre
métriques globales est sous 80 %, si un domaine critique est sous 90 % de
lignes, si un fichier critique déclaré n'apparaît pas dans la couverture, ou
si un autre gate technique échoue.

## Mesure courante

Mesure locale du 26 août 2026 après la fondation React/shadcn et le
durcissement fail-closed de la couverture, sur 153 fichiers de tests et 964
tests verts. Tous les fichiers TypeScript de production sous `api/` et `src/`
sont inclus, même lorsqu'aucun test ne les importe :

| Périmètre | Mesure | Cible de release | État |
| --- | ---: | ---: | --- |
| Statements globaux | 77,57 % | 80 % | ouvert |
| Branches globales | 69,24 % | 80 % | ouvert |
| Functions globales | 79,18 % | 80 % | ouvert |
| Lines globales | 79,01 % | 80 % | ouvert |
| Authentification et accès | 73,74 % (410/556) | 90 % lines | ouvert |
| Correction, pricing, crédits et réconciliation | 64,19 % (1 108/1 726) | 90 % lines | ouvert |
| Progression et évaluations | 81,80 % (1 007/1 231) | 90 % lines | ouvert |
| Autorisations admin | 80,56 % (232/288) | 90 % lines | ouvert |

Les listes de fichiers critiques sont explicites dans
`quality/v4-1-critical-domains.json`. Des règles de découverte par domaine
font échouer le gate si un nouveau fichier critique n'est pas déclaré. Une
absence de mesure échoue en mode final : elle n'est jamais assimilée à zéro
ligne à couvrir ni ignorée.

## Chaîne de contrôles

La baseline et le gate final couvrent, dans cet ordre :

1. génération Prisma ;
2. lint et typecheck ;
3. règles d'imports, frontières UI/serveur, absence de Preact et cycles
   interdits ;
4. tests et couverture globale ;
5. agrégation de la couverture par domaine critique ;
6. build de production ;
7. budgets du bundle initial, du plus gros chunk lazy et du précache PWA ;
8. audit des dépendances de production ;
9. en gate final uniquement, `knip` bloque fichiers, exports et dépendances
   inutilisés.

Le JS/CSS total reste un diagnostic de migration et n'est pas un gate de
release : le budget produit contractuel porte sur l'entrée initiale. Le plus
gros chunk lazy et le précache PWA disposent en plus d'un budget de régression
de 10 % dérivé de la première mesure reproductible, soit 10 018 octets gzip,
140 entrées et 1 371 224 octets émis.

Les parcours Recherche data-native possèdent en plus un gate Playwright dédié
avec `pnpm test:e2e:research`. La matrice fonctionnelle complète et les trous
d'intégration réels restent dans `docs/V4_1_FUNCTIONAL_PARITY_BASELINE.md`.

## Signaux d'arrêt

Un lot n'est pas promouvable si au moins un de ces signaux apparaît :

- régression par rapport à un comportement V4 gelé ;
- import Preact, cycle ou frontière de domaine interdite ;
- test supprimé, ignoré ou affaibli pour obtenir un résultat vert ;
- dépassement du budget JS, CSS ou PWA ;
- vulnérabilité haute/critique applicable ;
- mutation SQL issue du seul découpage Prisma ;
- défaut connu P0/P1 sans correction ;
- preuve QA absente pour une surface migrée.

## Preview et rollback

Chaque lot reste sur une branche/worktree dédié, avec SHA, commandes et limites
dans son handoff. Une preview ne remplace pas la recette de release. Le rollback
d'un lot UI consiste à revenir au dernier SHA revu sans migration de données.
`main` reste sur V4 jusqu'au GO propriétaire de `V4.1-504` ; la release finale
doit disposer d'un tag/SHA immuable, d'un build reproductible, d'une vérification
PWA et d'un chemin de retour documenté vers la V4.
