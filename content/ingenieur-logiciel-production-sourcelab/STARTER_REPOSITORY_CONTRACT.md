# Contrat du dépôt starter SourceLab 2.1

## Autorité et état vérifié

- Dépôt : `https://github.com/Guts6667/sourcelab`
- Baseline vérifiée : commit `6dd1cda`
- Tag publié : `checkpoint-00-starter`
- Audit : 22 août 2026

LearnX n’héberge pas le code SourceLab. Le contenu pédagogique doit donc
distinguer trois états : ce qui existe dans la baseline, ce que l’apprenant va
créer, et ce qui doit être publié comme solution avant réouverture du parcours.

À la date de l’audit, la baseline contient notamment `src/api/app.ts`,
`src/api/server.ts`, `src/config.ts`, `src/worker/main.ts`, un squelette Prisma
et `tests/health.test.ts`. Elle ne contient pas les TODO guidés, le repository
mémoire, les modèles finaux, Dockerfile, Compose, workflows ni tags solution
01–07 promis par la version précédente du programme.

## Disponibilité des checkpoints

| Checkpoint | État vérifié au 22 août 2026 | Condition attendue |
| --- | --- | --- |
| `checkpoint-00-starter` | publié au commit `6dd1cda` | API et test de santé exécutables |
| `checkpoint-01-request-visible` | absent | request ID dans réponse et logs |
| `checkpoint-02-project-contract` | absent | configuration parsée, contrat Zod et repository mémoire |
| `checkpoint-03-api-container` | absent | image multi-stage, non-root, sans secret |
| `checkpoint-04-postgres-project` | absent | Compose, migration, readiness et Project persistant |
| `checkpoint-05-source-queued` | absent | SourceVersion et ProcessingJob créés atomiquement |
| `checkpoint-06-rag-ready-local` | absent | worker, contenu normalisé, checksum et SourceVersion READY |
| `checkpoint-07-continuous-delivery` | absent | CI verte, image SHA et publication GHCR sur tag |

Les checkpoints dégradés des trois évaluations sont également absents. Cette
table est une gate de publication, pas une invitation à consulter des tags
inexistants.

## P0 — contrat de reconstruction du starter

Avant toute nouvelle inscription, le dépôt doit fournir :

1. des TODO bornés qui correspondent exactement aux micro-actions des sept
   leçons ;
2. les tags solution 01–07, chacun accessible sans écraser le travail de
   l’apprenant ;
3. trois checkpoints d’évaluation volontairement dégradés, ne contenant que
   des défauts déjà enseignés ;
4. un commit et un tag vérifiés pour chaque checkpoint ;
5. un scan attestant l’absence de secret et de donnée personnelle ;
6. un README avec commandes, sorties attendues et procédure de récupération.

Un checkpoint solution sert de filet de sécurité après une première tentative.
Il ne doit pas être requis pour comprendre la leçon et ne remplace jamais les
explications LearnX.

## Structure finale attendue

`checkpoint-06-rag-ready-local` contient au minimum l’API, le worker, les
contrats, Prisma, les migrations, les repositories, la normalisation Markdown,
le Dockerfile, `.dockerignore` et `compose.yaml`.
`checkpoint-07-continuous-delivery` ajoute le test d’intégration, le smoke et
les workflows `ci.yml` et `release.yml`, sans changer la frontière de données.

## Contrat de données pédagogique

- `Project` regroupe les sources.
- `Source` porte l’identité durable, dont `title` et `origin`.
- `SourceVersion` porte `versionLabel`, `mediaType`, `rawContent`,
  `normalizedContent`, `checksumSha256` et son statut.
- `ProcessingJob` représente le traitement et conserve son `errorCode`
  éventuel.
- Le premier format pris en charge est `text/markdown`.
- La normalisation convertit les fins de ligne, retire les espaces terminaux et
  garantit une seule fin de fichier avant le SHA-256.

La transaction d’import crée la version et le job `QUEUED` ensemble. Un échec
forcé ne doit laisser aucune ligne orpheline.

## Worker borné

Le worker traite un seul job à la fois. Il ne garantit ni exclusion mutuelle
entre plusieurs workers, ni retry, ni reprise après crash. Les leçons montrent
ces limites et ne présentent aucune de ces propriétés comme acquise.

## CI et livraison

- `ci.yml` s’exécute sur pull request et push : installation verrouillée, lint,
  typecheck, tests, build et construction de l’image.
- `release.yml` s’exécute uniquement sur un tag `v*`.
- GHCR utilise `GITHUB_TOKEN`, `contents: read` et `packages: write`.
- L’image reçoit un tag de version et un tag égal au SHA du commit.
- Le digest publié est conservé dans le journal de livraison.
- Le rollback renseigne un digest antérieur dans `SOURCELAB_IMAGE`, relance
  Compose puis exécute le smoke.
- Aucun déploiement cloud n’est simulé.

## Commandes de preuve à documenter dans le starter

Le README final doit donner, avec sorties interprétées, les commandes exactes
pour :

1. démarrer la baseline et lancer ses tests ;
2. construire et inspecter l’image ;
3. lancer migration, base, API et worker avec Compose ;
4. créer un projet puis importer une source Markdown ;
5. suivre le job jusqu’à `READY` et provoquer un `FAILED` contrôlé ;
6. vérifier titre, origine, version, statut et checksum en PostgreSQL ;
7. exécuter tests d’intégration et smoke ;
8. relever, sélectionner puis vérifier un digest antérieur.

## Gate de cohérence

Une revue technique doit comparer chaque extrait et commande des sept specs au
checkpoint correspondant. Toute divergence de chemin, dépendance, sortie,
statut HTTP ou valeur de hash bloque la republication et exige une mise à jour
conjointe du starter, de la spec et du bundle seed.
