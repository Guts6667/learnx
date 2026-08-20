# Contrat du dépôt starter SourceLab 2.0

## Autorité locale

- Chemin : `/Users/rayanchambet/Desktop/Workflow/sourcelab`
- Commit : `6dd1cda`
- Tag : `checkpoint-00-starter`

Le programme dépend de ce commit et de ce tag locaux, pas de la présence d'un
remote. Ce document n'autorise aucun ajout de code SourceLab dans LearnX.

## État initial obligatoire

Le tag `checkpoint-00-starter` doit contenir une API Hono TypeScript, un test de
santé vert, un squelette de worker, `.env.example`, les scripts pnpm et les
emplacements TODO nécessaires au parcours. Le starter compile, `pnpm dev`
expose `GET /health/live` et `pnpm test` passe.

Dockerfile, Compose, modèles métier, tests d'intégration et workflows de
livraison restent à compléter dans le parcours.

## Checkpoints contractuels

| Tag | Preuve minimale |
| --- | --- |
| `checkpoint-00-starter` | API et test de santé exécutables |
| `checkpoint-01-request-visible` | request ID dans réponse et logs |
| `checkpoint-02-project-contract` | configuration parsée, contrat Zod et repository mémoire |
| `checkpoint-03-api-container` | image multi-stage, non-root, sans secret |
| `checkpoint-04-postgres-project` | Compose, migration, readiness et Project persistant |
| `checkpoint-05-source-queued` | SourceVersion et ProcessingJob créés atomiquement |
| `checkpoint-06-rag-ready-local` | worker, contenu normalisé, checksum et SourceVersion READY |
| `checkpoint-07-continuous-delivery` | CI verte, image SHA et publication GHCR sur tag |

Chaque tag solution doit être accessible sans écraser le travail de
l'apprenant. Une branche d'exercice peut être comparée ou reprise fichier par
fichier. Les tags ne doivent contenir aucun secret ni donnée personnelle.

## Structure finale attendue

Le checkpoint `checkpoint-06-rag-ready-local` contient au minimum l'API, le
worker, les contrats, Prisma, les migrations, les repositories, la
normalisation Markdown, Dockerfile, `.dockerignore` et `compose.yaml`.
`checkpoint-07-continuous-delivery` ajoute le test d'intégration, le smoke et
les workflows `ci.yml` et `release.yml` sans modifier la frontière de données.

## Contrat de données pédagogique

- `Project` regroupe les sources.
- `Source` porte `title` et `origin`.
- `SourceVersion` porte `versionLabel`, `mediaType`, `rawContent`,
  `normalizedContent`, `checksumSha256` et son statut.
- `ProcessingJob` porte le traitement et son `errorCode` éventuel.
- Le format initial est `text/markdown`.
- La normalisation convertit les fins de ligne, retire les espaces terminaux et
  garantit une fin de fichier unique avant SHA-256.

## Worker borné

Le worker traite un seul job à la fois. Il ne garantit ni sécurité concurrente,
ni retry, ni reprise après crash. Les interfaces doivent permettre une extension
ultérieure, mais aucune robustesse absente ne doit être affirmée.

## CI et livraison

- `ci.yml` s'exécute sur pull request et push : installation verrouillée, lint,
  typecheck, tests, build et construction de l'image.
- `release.yml` s'exécute uniquement sur un tag `v*`.
- La publication GHCR utilise `GITHUB_TOKEN`, `contents: read` et
  `packages: write`.
- L'image reçoit un tag de version et un tag égal au SHA du commit.
- Le digest publié est conservé dans le journal de livraison.
- Aucun déploiement cloud n'est simulé.
- Le rollback manuel renseigne un digest antérieur dans `SOURCELAB_IMAGE`,
  relance Compose puis exécute le smoke.

## Commandes de preuve finales

Le README du starter doit fournir des commandes exactes pour :

1. `docker compose up --build` ;
2. créer un projet ;
3. importer une source Markdown ;
4. suivre le job jusqu'à `READY` ;
5. consulter la version ;
6. vérifier titre, origine, version et checksum dans PostgreSQL ;
7. exécuter tests et smoke ;
8. sélectionner puis vérifier un digest antérieur.

Les versions des dépendances, sorties attendues et scénarios d'erreur doivent
être contrôlés lors de la revue technique du starter avant publication.
