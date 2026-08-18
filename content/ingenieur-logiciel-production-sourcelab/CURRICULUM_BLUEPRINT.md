# Blueprint pédagogique — Ingénieur logiciel en production — Construire SourceLab

## Finalité

Construire SourceLab V1 comme produit autonome : créer un projet, importer des matériaux, suivre leur traitement, vérifier leur provenance et exporter un Source Pack propre.

SourceLab reste un produit indépendant : aucun exercice n’ajoute de tables, de routes ou de logique IA directement dans le dépôt LearnX. LearnX héberge le parcours ; le code du projet fil rouge vit ailleurs. Les intégrations futures sont des exports JSON ou API authentifiées et versionnées.

## Public et prérequis

Développeur frontend TypeScript expérimenté et Product Manager technique souhaitant posséder une verticale jusqu’à la production.

## Résultats d’apprentissage

1. Suivre et diagnostiquer une requête de bout en bout.
2. Containeriser une API et un worker TypeScript avec Docker et Compose.
3. Concevoir des contrats, transactions, jobs idempotents et migrations compatibles.
4. Tester les frontières réelles et construire une CI reproductible.
5. Déployer, observer et restaurer un service avec une méthode d’incident.

## Principes d’authoring

- Chaque leçon produit une preuve réutilisable dans SourceLab.
- Les ressources officielles sont guidées et ne valident jamais seules une notion.
- Chaque notion obligatoire possède une mini-évaluation et chaque leçon un quiz.
- Chaque étape possède une évaluation finale pratique.
- Les contenus techniques distinguent règle stable, choix contextuel et hypothèse à mesurer.
- Les sources de rédaction et les ressources apprenant sont déclarées séparément dans les sidecars.
- Les contenus restent `draft` jusqu’aux revues humaines.

## Architecture cible

### Étape — Comprendre le runtime et diagnostiquer

- Slug : `comprendre-runtime-diagnostiquer`
- Durée : 7 jours
- Leçons :
  - Suivre une requête du navigateur au processus (`suivre-requete-navigateur-processus`) — livrable : Une API minimale, un diagramme de séquence et un kit de diagnostic reproductible.
  - Valider configuration, réseau et arrêt propre (`valider-configuration-reseau-arret-propre`) — livrable : Un bootstrap TypeScript validé, des healthchecks et une procédure d’arrêt testée.
- Évaluation : Évaluation — Diagnostiquer une verticale SourceLab

### Étape — Containeriser un environnement multi-service

- Slug : `containeriser-environnement-multiservice`
- Durée : 10 jours
- Leçons :
  - Construire une image TypeScript reproductible (`construire-image-typescript-reproductible`) — livrable : Une image API multi-stage documentée, inspectée et exécutable sans état local implicite.
  - Orchestrer API, worker et PostgreSQL avec Compose (`orchestrer-api-worker-postgresql-compose`) — livrable : Un environnement local API-worker-PostgreSQL reproductible, sain et documenté.
- Évaluation : Évaluation — Exécuter SourceLab localement avec Docker

### Étape — Intégrer données et traitements asynchrones

- Slug : `integrer-donnees-traitements`
- Durée : 12 jours
- Leçons :
  - Concevoir les contrats et le modèle du Source Workspace (`concevoir-contrats-modele-source-workspace`) — livrable : Une verticale Project → Source → Status avec contrats Zod, modèle Prisma et tests.
  - Traiter les imports avec un worker idempotent (`traiter-imports-worker-idempotent`) — livrable : Une file PostgreSQL et un worker concurrents, reprenables et idempotents.
- Évaluation : Évaluation — Livrer le Source Workspace résilient

### Étape — Tester, livrer et opérer SourceLab V1

- Slug : `tester-livrer-operer`
- Durée : 13 jours
- Leçons :
  - Tester migrations et intégrations réelles (`tester-migrations-integrations-reelles`) — livrable : Une matrice de tests complète et une migration répétée sur un environnement jetable.
  - Construire CI, observabilité, déploiement et réponse à incident (`construire-ci-observabilite-deploiement`) — livrable : SourceLab V1 déployé, observable, testable et accompagné d’un runbook et d’un postmortem.
- Évaluation : Évaluation finale — Mettre SourceLab V1 en production


## Hors périmètre

- Administrer Kubernetes en production.
- Devenir SRE ou DevOps.
- Construire une plateforme cloud multi-région.
- Ajouter des fonctions IA avant que le socle soit fiable.
