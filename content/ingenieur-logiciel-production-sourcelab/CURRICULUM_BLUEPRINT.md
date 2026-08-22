# Blueprint pédagogique — SourceLab — Docker, API et socle d’ingestion

## Statut et finalité

- Version : 2.1.0
- Statut runtime : `draft`, nouvelles inscriptions suspendues
- Priorité : reconstruction P0 décidée le 22 août 2026
- Classification : `TECH_VALIDATION`
- Identité runtime : `sourcelab-docker-api-socle-ingestion`
- Volume cible : 14 h 20, évaluations comprises
- Dépôt : `https://github.com/Guts6667/sourcelab`
- Baseline vérifiée : commit `6dd1cda`, tag `checkpoint-00-starter`

Le périmètre de sept leçons reste cohérent. La reconstruction ne cherche pas à
allonger artificiellement le parcours : elle rend explicites les modèles
mentaux, relie le code aux commandes et demande une preuve observable après
chaque action. Le résultat borné reste une verticale locale qui produit une
`SourceVersion READY` traçable pour le programme RAG suivant.

## Public et prérequis

L’apprenant maîtrise TypeScript et sait utiliser un terminal, Git et pnpm. Il
peut être débutant en Hono, Docker, Compose, PostgreSQL/Prisma, tests
d’intégration et CI/CD. Le contenu définit donc le vocabulaire avant de
l’utiliser et ne délègue jamais une notion nouvelle à une documentation
externe.

## Résultats d’apprentissage

1. Retracer une requête entre client, processus Node, application Hono et
   handler, puis diagnostiquer 200, 404 et méthode non prise en charge.
2. Charger et valider une configuration au démarrage, puis appliquer un contrat
   Zod à `POST /projects` sans confondre validation, métier et stockage.
3. Expliquer image, container, couche et digest, puis construire une image
   multi-stage non-root, sans secret et configurable au runtime.
4. Orchestrer migration, PostgreSQL et API avec Compose, distinguer liveness et
   readiness, et prouver la persistance.
5. Modéliser `Project`, `Source`, `SourceVersion` et `ProcessingJob`, puis créer
   un import `QUEUED` atomique.
6. Normaliser une source, calculer son SHA-256 et rendre visibles les
   transitions `QUEUED -> PROCESSING -> READY|FAILED`.
7. Choisir un test selon un risque, automatiser CI et publication GHCR, puis
   identifier et vérifier un rollback par digest.

## Patron obligatoire d’une micro-séquence

Chaque leçon contient trois à six micro-séquences. Selon le besoin, une même
séquence peut associer plusieurs des éléments ci-dessous, mais aucun élément ne
peut être remplacé par « lire la documentation » :

1. vocabulaire expliqué en langage simple ;
2. schéma ou diagramme utile au raisonnement ;
3. extrait court, exact et commenté du starter ou du fichier à produire ;
4. commande exacte et contexte d’exécution ;
5. sortie attendue, stable ou motif vérifiable ;
6. interprétation : ce que la sortie prouve et ce qu’elle ne prouve pas ;
7. une micro-action productive ;
8. un contrôle déterministe ;
9. ressource externe proposée seulement après la synthèse interne.

Les explications libres soutiennent l’apprentissage, mais la validation d’une
compétence repose sur un statut, un test, un fichier, une requête SQL, un hash
ou une autre preuve rejouable.

La direction visuelle « Totem technique » considère le code comme la preuve et
le diagramme comme un révélateur de relations. Une liste courte reste
préférable lorsqu’elle suffit ; une figure est justifiée pour une branche, une
cardinalité, un changement de responsabilité ou une évolution temporelle.
Chaque figure reçoit une phrase d’intention avant, une conclusion « À retenir »
après et un résumé textuel équivalent.

## Architecture

### Étape 1 — Prendre en main une verticale TypeScript — 2 h 55

Module : `module-api-guidee-contrats`.

#### L1 — Starter et requête — 70 min

Slug : `prendre-en-main-starter-suivre-requete`.

- Carte du dépôt : rôle des dossiers et fichiers réellement présents.
- Processus Node et application Hono : différence entre démarrer l’écoute et
  déclarer les routes.
- Cycle HTTP : client, méthode, chemin, middleware, handler, réponse.
- Extraits commentés de `src/api/app.ts` et `src/api/server.ts`.
- Baseline exécutée puis middleware de request ID ajouté.
- Trois `curl` interprétés : succès, route absente et méthode non prise en
  charge. Le starter Hono actuel renvoie 404 sur `POST /health/live` ; le
  contenu ne doit pas promettre 405 sans handler explicite.
- Contrôle : statut, en-tête, log et request ID corrélés.

#### L2 — Configuration et contrat `Project` — 85 min

Slug : `definir-contrat-project-configuration`.

- Tableau des erreurs : configuration, contrat HTTP, métier et serveur.
- `process.env` fournit des chaînes ; `loadConfig` parse et échoue au
  démarrage, avant le premier handler.
- Tests séparés pour `PORT` valide, absent et invalide.
- Schéma Zod et `safeParse` : données acceptées, erreurs structurées et absence
  de mutation.
- Handler `POST /projects` et repository mémoire : responsabilités distinctes.
- Contrôles succès/invalide et preuve qu’un `title` vide ne crée rien.

#### Évaluation d’étape — 20 min

Réparer séparément un `PORT` invalide puis un `title` vide, sans reconstruire
l’API. Les preuves attendues sont tests, statuts, log et request ID.

### Étape 2 — Containeriser et persister SourceLab — 4 h 10

Module : `module-docker-compose-postgresql`.

#### L3 — Image Docker — 95 min

Slug : `construire-image-api-reproductible`.

- Image, container, couche, tag et digest.
- Séparation build/runtime dans un Dockerfile multi-stage annoté.
- Contexte de build, `.dockerignore` et secret absent de l’image.
- Deux builds comparés pour expliquer le cache.
- Inspection de l’utilisateur et de l’historique ; runtime non-root.
- `PORT` injecté à l’exécution et healthcheck contrôlé par `curl`.
- Contrôle : l’image démarre sans dépendre des `node_modules` de l’hôte.

#### L4 — Compose et PostgreSQL — 120 min

Slug : `orchestrer-api-postgresql-compose`.

- Topologie service/container/réseau/volume et résolution du nom `db`.
- Expérience guidée : casser puis corriger une URL utilisant `localhost`.
- Liveness, readiness et ordre de démarrage distingués.
- Schéma Prisma, migration et service de migration explicites.
- Repository PostgreSQL substitué au repository mémoire sans changer le
  contrat HTTP.
- Contrôle : stack propre, API ready, projet persistant après remplacement du
  container.

#### Évaluation d’étape — 35 min

Reconstruire la stack depuis un état propre, prouver runtime non-root,
readiness et persistance, puis diagnostiquer `localhost` avec une preuve réseau.

### Étape 3 — Ingérer et livrer le socle RAG — 7 h 15

Module : `module-sources-worker-livraison`.

#### L5 — Source, version et job — 120 min

Slug : `modeliser-mettre-en-file-source`.

- Responsabilités et cardinalités de `Project`, `Source`, `SourceVersion` et
  `ProcessingJob` dans un ERD.
- Exemples et contre-exemples : une nouvelle version ne duplique pas la source.
- Relations Prisma et migration expliquées avant exécution.
- Contrat Zod de l’import puis transaction qui crée version et job `QUEUED`.
- Échec forcé : aucune ligne orpheline ne doit subsister.
- Contrôle SQL sur cardinalités, statut et données exactes.

#### L6 — Worker simple — 135 min

Slug : `traiter-source-worker-simple`.

- Différence entre requête courte et traitement différé.
- Machine d’états API/worker avec responsabilités et limites de concurrence explicites.
- Normalisation testée puis SHA-256 comparé à une valeur connue.
- `processNextJob` traite un seul job et persiste chaque transition.
- Routes de suivi : cas nominal `READY`, puis échec forcé `FAILED` avec
  `errorCode` visible.
- Intégration Compose et limites explicites : pas de concurrence sûre, retry ni
  reprise après crash.

#### L7 — Tests, CI et livraison — 120 min

Slug : `tester-livrer-image-tracable`.

- Matrice risque -> preuve : test ciblé, intégration ou smoke.
- Test d’intégration de la verticale et script smoke reproductible.
- `ci.yml` commenté : installation verrouillée, qualité, tests, build et image.
- `release.yml` commenté : déclenchement sur tag, permissions minimales,
  version et SHA.
- Publication GHCR, relevé du digest puis rollback local sur ce digest.
- Contrôle : smoke vert avant publication et après rollback.

#### Évaluation finale — 60 min

Rejouer la verticale complète, vérifier l’atomicité, les transitions, le
checksum, les données SQL, les tests et le smoke, puis produire un journal de
livraison contenant tag, SHA, digest et preuve de rollback.

## État final visé du dépôt

Le checkpoint final doit contenir API, worker, Prisma, migrations, Dockerfile,
Compose, tests, smoke et workflows GitHub Actions. Le parcours nominal expose :

- `GET /health/live` et `GET /health/ready` ;
- `POST /projects` ;
- `POST /projects/:projectId/imports` ;
- `GET /imports/:jobId` ;
- `GET /sources/:sourceId/versions`.

La source initiale est du texte ou Markdown avec `title`, `origin`,
`versionLabel`, contenu normalisé et `checksumSha256`.

## Frontière avec le programme RAG

Ce programme s’arrête à :

```text
SourceVersion READY
+ texte ou Markdown normalisé
+ titre, origine et version
+ checksum SHA-256
```

Le programme RAG commence par le découpage, la provenance des chunks,
l’indexation et le retrieval. Embeddings, pgvector, citations et génération ne
sont jamais requis ici.

## Conditions de republication

Le statut ne pourra repasser à `active` qu’après : publication et vérification
des TODO/checkpoints du starter, exactitude des extraits, disponibilité d’au
moins six figures accessibles, test des commandes et sorties, alignement
specs/seed/évaluations, revues humaines renseignées, pilote L1 puis L3/L4 et
tests de parcours sur desktop et mobile.
