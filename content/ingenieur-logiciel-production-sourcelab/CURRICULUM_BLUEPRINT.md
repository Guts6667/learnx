# Blueprint pédagogique — SourceLab — Docker, API et socle d’ingestion

## Statut et finalité

- Version : 2.0.0
- Statut runtime : `active`, publication publique autorisée le 21 août 2026
- Classification : `CONTENT_ONLY`
- Identité runtime : `sourcelab-docker-api-socle-ingestion`
- Volume : 13 h 05, évaluations comprises
- Dépôt : `https://github.com/Guts6667/sourcelab`
- Baseline starter : commit `6dd1cda`, tag
  `https://github.com/Guts6667/sourcelab/tree/checkpoint-00-starter`

La version 2 remplace intégralement le parcours de 42 jours. Elle vise un
résultat borné : faire fonctionner localement une verticale SourceLab puis
livrer une `SourceVersion` traçable au programme RAG suivant.

La V2 reçoit un slug et une clé canonique distincts afin d’éviter toute
équivalence implicite avec la V1. Le programme historique conserve sa propre
identité et ses progressions ; le titre visible V2 devient « SourceLab — Docker,
API et socle d’ingestion ».

## Public et prérequis

Profil de départ retenu : TypeScript 3/3, API Node 2/3, Docker 1/3, Compose 1/3,
PostgreSQL/Prisma 1/3, tests 0/3 et CI/CD 0/3. L'apprenant sait lire un dépôt
TypeScript et exécuter des commandes pnpm, mais le parcours n'exige aucune
autonomie préalable en infrastructure.

## Résultats d'apprentissage

1. Suivre une requête dans un starter Hono et valider ses entrées avec Zod.
2. Construire une image API multi-stage et configurable au runtime.
3. Orchestrer migration, PostgreSQL et API avec Compose.
4. Modéliser `Project`, `Source`, `SourceVersion` et `ProcessingJob` avec Prisma.
5. Traiter une source Markdown avec un worker simple et un checksum SHA-256.
6. Prouver la verticale par tests d'intégration et smoke.
7. Valider les changements en CI, publier l'image sur GHCR lors d'un tag et
   revenir manuellement à un digest antérieur.

## Principes d'authoring

- Le tag `checkpoint-00-starter` précède toute activité productive.
- Chaque leçon part d'un checkpoint nommé et modifie le même projet fil rouge.
- Les contenus internes expliquent la procédure ; les documentations externes
  sont courtes, ciblées et ne remplacent jamais le guidage.
- Les ressources guidées précèdent l’activité productive dans chaque séquence.
  Les tâches `practice` et `project` gardent `resourceKeys: []` afin de ne pas
  dupliquer une activité productive sous forme de tâche passive.
- Après quinze minutes de blocage, un checkpoint solution peut servir de filet
  de sécurité sans effacer la première tentative.
- Chaque leçon produit une preuve réutilisée par la suivante.
- Les évaluations d'étape réparent ou rejouent une frontière déjà enseignée ;
  elles n'ajoutent aucune fonctionnalité surprise.
- Les limites du worker et de la livraison sont affichées comme telles.

## Architecture

### Étape 1 — Prendre en main une verticale TypeScript

- Slug : `demarrer-verticale-sourcelab`
- Durée : 2 h 35, évaluation comprise
- Module : `module-api-guidee-contrats`
- Leçons :
  - Prendre en main le starter et suivre une requête
    (`prendre-en-main-starter-suivre-requete`) — 60 min — livrable :
    `checkpoint-01-request-visible`.
  - Définir le contrat Project et valider la configuration
    (`definir-contrat-project-configuration`) — 75 min — livrable :
    `checkpoint-02-project-contract`.
- Évaluation : réparer une configuration et un contrat volontairement
  dégradés — 20 min.

### Étape 2 — Containeriser et persister SourceLab

- Slug : `containeriser-persister-sourcelab`
- Durée : 4 h, évaluation comprise
- Module : `module-docker-compose-postgresql`
- Leçons :
  - Construire une image API reproductible
    (`construire-image-api-reproductible`) — 90 min — livrable :
    `checkpoint-03-api-container`.
  - Orchestrer API et PostgreSQL avec Compose
    (`orchestrer-api-postgresql-compose`) — 120 min — livrable :
    `checkpoint-04-postgres-project`.
- Évaluation : reconstruire la stack, prouver la persistance et diagnostiquer
  le piège `localhost` — 30 min.

### Étape 3 — Ingérer et livrer le socle RAG

- Slug : `ingerer-livrer-socle-rag`
- Durée : 6 h 30, évaluation comprise
- Module : `module-sources-worker-livraison`
- Leçons :
  - Modéliser et mettre en file une source
    (`modeliser-mettre-en-file-source`) — 120 min — livrable :
    `checkpoint-05-source-queued`.
  - Traiter une source avec un worker simple
    (`traiter-source-worker-simple`) — 130 min — livrable : une
    `SourceVersion READY` dans `checkpoint-06-rag-ready-local`.
  - Tester et livrer une image traçable
    (`tester-livrer-image-tracable`) — 95 min — livrable :
    `checkpoint-07-continuous-delivery`.
- Évaluation finale : lancer le parcours complet, vérifier la version en base,
  exécuter tests et smoke puis défendre publication et rollback — 45 min.

## État final du dépôt

Le checkpoint final contient une API, un worker, Prisma, les migrations,
Dockerfile, Compose, tests, smoke et workflows GitHub Actions. Le parcours
nominal expose au moins :

- `GET /health/live` et `GET /health/ready` ;
- `POST /projects` ;
- `POST /projects/:projectId/imports` ;
- `GET /imports/:jobId` ;
- `GET /sources/:sourceId/versions`.

La source initiale est du texte ou Markdown avec `title`, `origin`,
`versionLabel`, contenu normalisé et `checksumSha256`.

## Frontière avec le programme RAG

Ce programme s'arrête à :

```text
SourceVersion READY
+ texte ou Markdown normalisé
+ titre, origine et version
+ checksum SHA-256
```

Le programme RAG commence après `checkpoint-07-continuous-delivery`, dont la
brique de données issue de `checkpoint-06-rag-ready-local` est :

```text
SourceVersion READY
-> DocumentVersion
-> Chunk avec offsets et provenance
-> indexation et retrieval
```

`Chunk`, embeddings, pgvector, recherche, citations, génération, Program
Builder et moteur de rubrique n'appartiennent pas à ce programme.

## Hors périmètre

- Plusieurs workers concurrents, verrouillage distribué et reprise après crash.
- Retry automatique et file externe.
- Fichiers binaires et stockage objet.
- Déploiement cloud, Kubernetes, SRE et observabilité distribuée.
- Fonctions IA et décisions de progression LearnX.

## Remplacement de la version 1

Les trois étapes, sept leçons et trois évaluations de cette carte remplacent
les quatre étapes, huit leçons et quatre évaluations antérieures. Une progression
existante ne doit pas être remappée silencieusement ; toute reprise de données
ou logique de progression relève d'une validation technique distincte.
