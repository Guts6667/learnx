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

Mesure locale du 26 août 2026 après la fondation React/shadcn et l'ajout du
gate, sur 152 fichiers de tests et 956 tests verts :

| Périmètre | Mesure | Cible de release | État |
| --- | ---: | ---: | --- |
| Statements globaux | 75,67 % | 80 % | ouvert |
| Branches globales | 66,90 % | 80 % | ouvert |
| Functions globales | 77,41 % | 80 % | ouvert |
| Lines globales | 76,90 % | 80 % | ouvert |
| Authentification et accès | 78,97 % (353/447) | 90 % lines | ouvert |
| Correction, pricing, crédits et réconciliation | 56,97 % (646/1 134) | 90 % lines | ouvert |
| Progression et évaluations | 81,02 % (734/906) | 90 % lines | ouvert |
| Autorisations admin | 80,56 % (232/288) | 90 % lines | ouvert |

Les listes de fichiers critiques sont explicites dans
`quality/v4-1-critical-domains.json`. Une absence de mesure échoue en mode
final : elle n'est jamais assimilée à zéro ligne à couvrir ni ignorée.

## Chaîne de contrôles

La baseline et le gate final couvrent, dans cet ordre :

1. génération Prisma ;
2. lint et typecheck ;
3. règles d'imports, absence de Preact et cycles interdits ;
4. tests et couverture globale ;
5. agrégation de la couverture par domaine critique ;
6. build de production ;
7. budgets des bundles et du précache PWA ;
8. audit des dépendances de production.

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

