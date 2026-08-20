# SourceLab — Docker, API et socle d’ingestion

## Statut

- Version : 2.0.0
- Statut : `draft`
- Classification : `CONTENT_ONLY`
- Projet fil rouge : dépôt SourceLab autonome, séparé de LearnX
- Starter local : `/Users/rayanchambet/Desktop/Workflow/sourcelab`, commit
  `6dd1cda`, tag `checkpoint-00-starter`
- Durée totale : 13 h 05, évaluations comprises
- Rythme indicatif : 7 séances sans contrainte calendaire
- Public : développeur TypeScript autonome côté frontend, débutant en Docker,
  Compose, PostgreSQL/Prisma, tests et CI/CD.

## Promesse

Construire un socle SourceLab local et compréhensible : une API Hono/Zod, une
image Docker, PostgreSQL avec Prisma, une ingestion texte ou Markdown, un worker
simple, des tests et une image GHCR traçable. Le checkpoint final fournit au
programme RAG une `SourceVersion` prête à être découpée et indexée.

Cette version remplace le programme historique « Ingénieur logiciel en
production — Construire SourceLab » sans changer son slug ni sa clé canonique.

Le parcours part d'un starter fonctionnel. Il ne demande jamais de créer une
API depuis une page blanche après une lecture générale. Chaque leçon annonce le
checkpoint de départ, les fichiers à modifier, les commandes de preuve, la
brique réutilisée ensuite et un checkpoint de récupération.

## Résultat observable

Depuis `checkpoint-07-continuous-delivery`, l'apprenant peut :

- lancer migration, PostgreSQL, API et worker avec
  `docker compose up --build` ;
- créer un projet ;
- importer une source avec titre, origine, version et contenu Markdown ;
- suivre `QUEUED -> PROCESSING -> READY` ;
- vérifier en PostgreSQL le contenu normalisé et son checksum SHA-256 ;
- exécuter tests et smoke ;
- expliquer la CI, la publication GHCR sur tag et le retour manuel à un digest
  antérieur.

## Frontière assumée

Le programme ne couvre pas concurrence de workers, retry automatique, reprise
après crash, fichiers binaires, embeddings, pgvector, retrieval, génération
LLM, déploiement cloud ou observabilité distribuée. La livraison continue
s'arrête à la publication GHCR ; aucune infrastructure absente n'est simulée.

## Contenu du dossier

- `CURRICULUM_BLUEPRINT.md` : architecture et progression ;
- `STARTER_REPOSITORY_CONTRACT.md` : contrat du dépôt externe et checkpoints ;
- `specs/` : sept spécifications de leçons ;
- `stage-assessments/` : trois évaluations pratiques non redondantes ;
- `SOURCE_MANIFEST.json` : inventaire et état de recontrôle des ressources ;
- `../../seed/ingenieur-logiciel-production-sourcelab-program.json` : bundle
  Prisma en brouillon.

## Porte de publication

Le programme reste `draft` et `readyForPublication: false` tant que les
checkpoints postérieurs au starter et les revues éditoriale, technique,
pédagogique, des liens et de compatibilité seed ne sont pas approuvés. Les
anciennes leçons de la version 1 ne sont pas déclarées équivalentes aux nouveaux
checkpoints.
