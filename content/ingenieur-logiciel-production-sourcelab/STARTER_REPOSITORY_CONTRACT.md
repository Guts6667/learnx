# Contrat du dépôt starter SourceLab 2.1

## Autorité et état vérifié

- Dépôt : `https://github.com/Guts6667/sourcelab`
- Baseline vérifiée : commit `6dd1cda`
- Tag publié : `checkpoint-00-starter`
- Dernière vérification : 22 août 2026
- PR de reconstruction : `Guts6667/sourcelab#1`
- Merge `main` vérifié : `47243bb`

LearnX n’héberge pas le code SourceLab. Le contenu pédagogique doit donc
distinguer trois états : ce qui existe dans la baseline, ce que l’apprenant va
créer, et ce qui doit être publié comme solution avant réouverture du parcours.

La baseline `checkpoint-00-starter` reste volontairement minimale. La PR
SourceLab #1 construit ensuite chaque brique dans un commit distinct, documente
les micro-actions dans `docs/LEARNING_TASKS.md` et publie les solutions sans
modifier rétroactivement le point de départ.

## Disponibilité des checkpoints

| Checkpoint | Commit vérifié | Preuve principale |
| --- | --- | --- |
| `checkpoint-00-starter` | publié au commit `6dd1cda` | API et test de santé exécutables |
| `checkpoint-01-request-visible` | `de911b9` | request ID dans réponse et logs |
| `checkpoint-02-project-contract` | `5ed5a7a` | configuration parsée, contrat Zod et repository mémoire |
| `checkpoint-03-api-container` | `3aa8e58` | image multi-stage et runtime non-root |
| `checkpoint-04-postgres-project` | `d1e6a49` | Compose, migration, readiness et Project persistant |
| `checkpoint-05-source-queued` | `377be70` | SourceVersion et ProcessingJob créés atomiquement |
| `checkpoint-06-rag-ready-local` | `ef254e9` | worker, contenu normalisé, checksum et SourceVersion READY |
| `checkpoint-07-continuous-delivery` | `3bde07e` | intégration, smoke, CI et release GHCR |

Les trois checkpoints d’évaluation sont publiés séparément :
`assessment-01-broken-config-contract` (`be9f316`),
`assessment-02-broken-compose-network` (`5d34418`) et
`assessment-03-final-rag-ready` (`9257bf4`). Leurs défauts sont intentionnels et
ne doivent pas être fusionnés dans `main`.

## P0 starter — réalisé

La reconstruction publiée fournit :

1. des TODO bornés qui correspondent exactement aux micro-actions des sept
   leçons ;
2. les tags solution 01–07, chacun accessible sans écraser le travail de
   l’apprenant ;
3. trois checkpoints d’évaluation volontairement dégradés, ne contenant que
   des défauts déjà enseignés ;
4. un commit et un tag vérifiés pour chaque checkpoint ;
5. un scan attestant l’absence de secret et de donnée personnelle ;
6. un README avec commandes, sorties attendues et procédure de récupération.

Les six points sont présents. La CI de la PR puis celle du merge `main` ont
validé installation verrouillée, génération Prisma, lint, typecheck, tests,
build, image runtime, migrations PostgreSQL, intégration API/worker, smoke et
teardown. Un scan de motifs de secrets et la revue du contexte Docker n’ont
détecté aucun secret ; les identifiants PostgreSQL committés sont explicitement
locaux et non sensibles.

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

La reconstruction technique est disponible et testée. La republication reste
conditionnée à la revue humaine des extraits et commandes, à l’alignement du
bundle seed, puis au pilote L1 et L3/L4. Toute divergence de chemin, dépendance,
sortie, statut HTTP ou valeur de hash exige une mise à jour conjointe du
starter, de la spec et du bundle seed.
