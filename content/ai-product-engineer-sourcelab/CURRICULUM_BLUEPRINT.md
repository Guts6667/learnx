# Blueprint pédagogique — AI Product Engineer — RAG et évaluation avec SourceLab

## Finalité

Ajouter à SourceLab deux usages bornés : créer des programmes LearnX à partir d’un besoin et de sources, puis proposer des corrections de textes libres fondées sur une grille et un corpus autorisé.

SourceLab reste un produit indépendant : aucun exercice n’ajoute de tables, de routes ou de logique IA directement dans le dépôt LearnX. LearnX héberge le parcours ; le code du projet fil rouge vit ailleurs. Les intégrations futures sont des exports JSON ou API authentifiées et versionnées.

## Public et prérequis

Développeur TypeScript/Product Engineer ayant terminé
`checkpoint-07-continuous-delivery` du programme SourceLab 2.0 dans le dépôt
séparé, ou disposant d’un service local équivalent produisant une
`SourceVersion READY` traçable. Le checkpoint constitue l’unique raccord
obligatoire ; le programme RAG ne suppose aucune fonctionnalité au-delà.

## Résultats d’apprentissage

1. Construire un corpus versionné et traçable à partir des sources SourceLab.
2. Implémenter embeddings, pgvector, recherche hybride, citations et abstention.
3. Créer un funnel, un brief et un Program Builder compatible LearnX.
4. Construire un moteur de rubrique exécutable où les modèles recherchent ou contestent des preuves et où LearnX calcule les niveaux.
5. Évaluer, sécuriser, observer et livrer des fonctions IA avec des gates mesurables.

## Principes d’authoring

- Chaque leçon produit une preuve réutilisable dans SourceLab.
- Les ressources officielles sont guidées et ne valident jamais seules une notion.
- Chaque notion obligatoire possède une mini-évaluation et chaque leçon un quiz.
- Chaque étape possède une évaluation finale pratique.
- Les contenus techniques distinguent règle stable, choix contextuel et hypothèse à mesurer.
- Les sources de rédaction et les ressources apprenant sont déclarées séparément dans les sidecars.
- Les contenus restent `draft` jusqu’aux revues humaines.

## Architecture cible

### Étape — Préparer un corpus IA fiable

- Slug : `preparer-corpus-ia-fiable`
- Durée : 9 jours
- Leçons :
  - Cadrer les usages IA et les contrats de SourceLab (`cadrer-usages-ia-contrats-sourcelab`) — livrable : Deux ADR et des contrats Zod explicitant responsabilités, autorités déterministes et abstention.
  - Extraire, normaliser et versionner un corpus traçable (`extraire-normaliser-versionner-corpus`) — livrable : Un corpus canonique, versionné et indexable, avec deux stratégies de chunking comparables.
- Évaluation : Évaluation — Spécifier et produire un corpus SourceLab

### Étape — Construire retrieval et RAG sourcé

- Slug : `construire-retrieval-rag-source`
- Durée : 12 jours
- Leçons :
  - Comprendre embeddings, distances et pgvector (`comprendre-embeddings-distances-pgvector`) — livrable : Un retriever vectoriel TypeScript/pgvector accompagné d’un benchmark exact versus HNSW.
  - Construire une recherche hybride et un RAG sourcé (`construire-recherche-hybride-rag-source`) — livrable : Un RAG hybride avec citations serveur, abstention et rapport comparatif.
- Évaluation : Évaluation — Comparer et défendre un retriever SourceLab

### Étape — Créer le Program Builder

- Slug : `creer-program-builder`
- Durée : 14 jours
- Leçons :
  - Transformer un besoin en funnel et brief pédagogique (`transformer-besoin-funnel-brief-pedagogique`) — livrable : Un funnel adaptatif et un brief traçable, révisable et validé avant génération.
  - Générer un blueprint puis modifier des leçons ciblées (`generer-blueprint-modifier-lecons-ciblees`) — livrable : Un Program Builder progressif exportant un programme LearnX vérifié et modifiable par patch ciblé.
- Évaluation : Évaluation — Générer un programme LearnX contrôlé

### Étape — Évaluer des réponses et livrer les fonctions IA

- Slug : `evaluer-reponses-livrer-ia`
- Durée : 14 jours
- Leçons :
  - Corriger un texte libre avec une grille préexistante (`corriger-texte-libre-grille-preexistante`) — livrable : Un moteur de rubrique exécutable avec recherche de preuves, certificat vérifiable, calcul déterministe et abstention.
  - Évaluer, sécuriser et opérer les fonctions IA (`evaluer-securiser-operer-fonctions-ia`) — livrable : Une suite d’évaluations et de sécurité versionnée, avec gates de release, observabilité et rollback.
- Évaluation : Évaluation finale — Livrer le moteur de rubrique et la qualité IA


## Hors périmètre

- Entraîner un modèle fondation.
- Construire un agent généraliste autonome.
- Partager directement la base de SourceLab avec LearnX.
- Valider automatiquement toute réponse à fort enjeu.
- Remplacer la gouvernance éditoriale de LearnX.
