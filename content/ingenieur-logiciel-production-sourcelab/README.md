# SourceLab — Docker, API et socle d’ingestion

## Statut

- Version éditoriale : 2.1.0 en reconstruction
- Statut runtime : `draft`
- Priorité : P0, demandée par le propriétaire le 22 août 2026
- Classification : `TECH_VALIDATION`
- Identité runtime : `sourcelab-docker-api-socle-ingestion`
- Projet fil rouge : dépôt SourceLab autonome, séparé de LearnX
- Baseline vérifiée : commit `6dd1cda`, tag `checkpoint-00-starter`
- Durée cible : 14 h 20, évaluations comprises
- Rythme indicatif : sept séances, sans contrainte calendaire

Les nouvelles inscriptions restent suspendues pendant la reconstruction. Le
bundle est volontairement en `draft` : le contenu enrichi peut être relu et
testé sans être présenté comme un parcours autonome déjà validé.

## Promesse pédagogique

Le parcours apprend à construire une verticale SourceLab locale : API
Hono/Zod, image Docker, Compose, PostgreSQL/Prisma, ingestion Markdown, worker
simple, tests et image GHCR traçable. Il prépare une `SourceVersion READY` pour
le programme RAG suivant, sans prétendre couvrir une exploitation cloud.

Chaque leçon est désormais découpée en trois à six micro-séquences. Une
micro-séquence introduit le vocabulaire, montre un diagramme ou un extrait réel
du starter, donne une commande et sa sortie attendue, explique ce que cette
sortie prouve, puis demande une seule action assortie d’un contrôle
déterministe. Une documentation externe complète la synthèse LearnX ; elle ne
porte plus l’explication principale.

Les figures suivent sept raisonnements distincts : cycle d’une requête, contrat
de configuration, couches d’image, réseau Compose, relations de données,
machine d’états du worker et chaîne de livraison. Elles disposent d’un texte
alternatif et le contenu adjacent en donne toujours l’équivalent textuel.
La direction « Totem technique » retenue pose le code comme preuve et réserve
le diagramme aux relations difficiles à lire dans le code : branche,
cardinalité, changement de responsabilité ou état dans le temps. Les figures
ne sont jamais décoratives ; sur mobile, leur région est défilable au clavier
et leur résumé textuel demeure suffisant.

## Progression reconstruite

1. Distinguer dépôt, processus Node, application Hono, route et cycle HTTP ;
   diagnostiquer succès, 404 et méthode non prise en charge avec un request ID.
2. Séparer lecture de l’environnement, parsing au démarrage, validation Zod,
   handler et repository mémoire ; classer les erreurs de contrat et de
   serveur.
3. Distinguer image, container, couche et digest ; construire une image
   multi-stage, mise en cache, non-root et configurée au runtime.
4. Relier API et PostgreSQL par le réseau Compose ; expliquer pourquoi
   `localhost` est faux depuis un container, migrer puis prouver readiness et
   persistance.
5. Modéliser `Project`, `Source`, `SourceVersion` et `ProcessingJob`, puis créer
   version et job `QUEUED` dans une transaction vérifiée.
6. Normaliser un texte, calculer son SHA-256 et faire évoluer un job vers
   `READY` ou `FAILED`, tout en nommant les limites de concurrence et de retry.
7. Relier risques, tests ciblés, intégration, smoke, CI, tag, SHA, digest GHCR
   et rollback manuel.

## Évaluations

- Étape 1 : 20 min — réparer séparément `PORT` puis un `title` vide et fournir
  statuts, logs, request ID et tests.
- Étape 2 : 35 min — reconstruire une stack propre, prouver non-root,
  readiness et persistance, puis diagnostiquer `localhost`.
- Étape 3 : 60 min — rejouer la verticale, vérifier transaction, transitions,
  checksum, CI, digest et rollback dans un journal de livraison.

Les réponses libres restent formatives. La validation repose sur des preuves
rejouables : tests, commandes, requêtes SQL, hashes, statuts CI et fichiers
attendus.

## État réel du starter

Au 22 août 2026, seul `checkpoint-00-starter` est publié et vérifié. Les tags
solution `checkpoint-01` à `checkpoint-07`, les TODO guidés et les checkpoints
d’évaluation dégradés ne sont pas disponibles dans le dépôt public. Les leçons
décrivent la progression cible, mais leur publication reste bloquée tant que le
contrat du starter n’est pas satisfait. Aucun texte ne doit inviter un
apprenant à consulter un checkpoint absent.

## Gates avant republication

### P0 — obligatoires

- Starter : TODO réels, solutions 01–07, checkpoints d’évaluation dégradés,
  tags et commits vérifiés, aucun secret.
- Contenu : synthèse interne suffisante, extraits exacts, au moins six
  diagrammes utiles, commandes et sorties testées, une intention par
  micro-activité.
- Cohérence : sidecars, bundle seed, durées, checkpoints et statut runtime
  alignés ; revues éditoriale et technique explicitement renseignées.

### P1 — avant réouverture générale

- Pilote : un apprenant réalise L1 puis L3/L4 sans assistance ; temps,
  blocages et recours aux solutions sont observés.
- Publication : liens, seed, parcours, accessibilité, responsive mobile et
  preuves déterministes sont testés.

## Frontière assumée

Le programme ne couvre pas les workers concurrents, le retry automatique, la
reprise après crash, les fichiers binaires, embeddings, pgvector, retrieval,
génération LLM, Kubernetes ni l’observabilité distribuée. La livraison continue
s’arrête à la publication GHCR ; aucune infrastructure absente n’est simulée.

## Contenu du dossier

- `CURRICULUM_BLUEPRINT.md` : architecture et progression ;
- `STARTER_REPOSITORY_CONTRACT.md` : état vérifié et contrat des checkpoints ;
- `specs/` : sept leçons reconstruites ;
- `stage-assessments/` : trois évaluations pratiques ;
- `SOURCE_MANIFEST.json` : inventaire des sources vérifiées ;
- `../../seed/ingenieur-logiciel-production-sourcelab-program.json` : bundle
  Prisma en `draft`.
