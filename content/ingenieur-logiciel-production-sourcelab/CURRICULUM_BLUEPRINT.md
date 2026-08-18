# Blueprint pédagogique — Ingénieur logiciel en production — Construire SourceLab

## Statut

- Programme cible : `ingenieur-logiciel-production-sourcelab`
- Version : 1.0.0
- Statut : blueprint complet en brouillon
- Classification : `CONTENT_ONLY`
- Projet fil rouge : SourceLab, dépôt externe à LearnX
- Durée indicative : 42 jours / 48 heures

## Finalité

Former un Product Engineer capable de comprendre l’exécution, containeriser, intégrer, tester, déployer et diagnostiquer son propre service. Le parcours ne cherche ni l’administration de plateforme ni une certification DevOps.

## Résultat attendu

À la fin, l’apprenant livre SourceLab V1 : une application séparée permettant de créer un projet, importer une source, suivre son traitement, vérifier ses métadonnées, la classer et exporter un Source Pack. Il peut expliquer et réparer toute la chaîne navigateur → API → job → worker → PostgreSQL.

## Principes pédagogiques

- Chaque leçon produit une modification, une décision ou une preuve dans le dépôt SourceLab externe.
- Les ressources officielles sont guidées et bornées ; leur ouverture ne valide jamais la notion.
- Les contenus progressent du modèle mental vers la livraison et l’opération.
- Chaque notion obligatoire possède une mini-évaluation, chaque leçon un quiz et chaque étape une évaluation finale.
- Les scénarios distinguent faits documentés, choix d’architecture et hypothèses propres à SourceLab.
- Aucun sujet n’est ajouté uniquement pour couvrir un catalogue DevOps ou ML.

## Architecture

### Étape 1 — Comprendre l’exécution d’une application

- Slug : `comprendre-execution-application`
- Module : `runtime-http-diagnostic` — Runtime, HTTP et diagnostic
- Charge indicative : 7 jours
- Finalité : Suivre une requête, localiser un défaut et expliquer la différence entre code, processus et environnement.

Leçons :
- Suivre une requête du navigateur au processus Node.js (`suivre-requete-navigateur-processus-node`)
- Diagnostiquer une application qui ne répond pas (`diagnostiquer-application-qui-ne-repond-pas`)

Évaluation finale : Évaluation — Diagnostiquer SourceLab de bout en bout.

### Étape 2 — Containeriser SourceLab

- Slug : `containeriser-sourcelab`
- Module : `docker-compose` — Docker et Compose
- Charge indicative : 7 jours
- Finalité : Construire un environnement local reproductible pour l’API, le worker, PostgreSQL et le stockage.

Leçons :
- Construire une image TypeScript reproductible (`construire-image-typescript-reproductible`)
- Orchestrer API, worker et PostgreSQL avec Compose (`orchestrer-api-worker-postgresql-compose`)

Évaluation finale : Évaluation — Livrer la stack locale SourceLab.

### Étape 3 — Intégrer l’API et les traitements

- Slug : `integrer-api-traitements`
- Module : `contrats-jobs` — Contrats et jobs asynchrones
- Charge indicative : 7 jours
- Finalité : Créer l’import d’une source et son traitement par un worker sans doublons ni effets silencieux.

Leçons :
- Définir les contrats d’import et de traitement (`definir-contrats-import-traitement`)
- Rendre les jobs idempotents et reprenables (`rendre-jobs-idempotents-reprenables`)

Évaluation finale : Évaluation — Import idempotent d’une source.

### Étape 4 — Fiabiliser les données et les fichiers

- Slug : `fiabiliser-donnees-fichiers`
- Module : `postgresql-migrations-provenance` — PostgreSQL, migrations et provenance
- Charge indicative : 7 jours
- Finalité : Modéliser projets, sources, versions et traitements tout en préservant les données pendant les évolutions.

Leçons :
- Modéliser les sources et maîtriser les transactions (`modeliser-sources-maitriser-transactions`)
- Faire évoluer le schéma et versionner les fichiers (`faire-evoluer-schema-versionner-fichiers`)

Évaluation finale : Évaluation — Faire évoluer le modèle SourceLab sans perte.

### Étape 5 — Prouver le fonctionnement

- Slug : `prouver-fonctionnement`
- Module : `tests-integration-continue` — Tests et intégration continue
- Charge indicative : 7 jours
- Finalité : Construire une matrice de tests et une CI qui donnent une preuve utile sur chaque changement.

Leçons :
- Construire une stratégie de tests utile (`construire-strategie-tests-utile`)
- Automatiser l’intégration continue (`automatiser-integration-continue`)

Évaluation finale : Évaluation — Construire la porte de qualité SourceLab.

### Étape 6 — Livrer et opérer SourceLab

- Slug : `livrer-operer-sourcelab`
- Module : `observabilite-release-incidents` — Observabilité, release et incidents
- Charge indicative : 7 jours
- Finalité : Déployer SourceLab V1, observer son comportement et restaurer le service lorsqu’un traitement se dégrade.

Leçons :
- Observer SourceLab sans exposer ses données (`observer-sourcelab-sans-exposer-donnees`)
- Déployer, restaurer et apprendre d’un incident (`deployer-restaurer-apprendre-incident`)

Évaluation finale : Évaluation finale — Mettre SourceLab V1 en service.

## Projet fil rouge

SourceLab est un outil autonome qui transforme des matériaux pédagogiques bruts en corpus structuré, puis utilise ce corpus pour générer des programmes et proposer des corrections. Le premier programme livre la boucle V1 ; le second ajoute les fonctions IA.

## Hors périmètre

- Administration Kubernetes, Terraform avancé ou métier SRE.
- Entraînement de modèles, deep learning et MLOps de modèles propriétaires.
- Accès direct à la base LearnX, publication automatique ou notation définitive sans autorité LearnX/humaine.
