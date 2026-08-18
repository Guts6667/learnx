# Blueprint pédagogique — AI Product Engineer — RAG et évaluation avec SourceLab

## Statut

- Programme cible : `ai-product-engineer-sourcelab`
- Version : 1.0.0
- Statut : blueprint complet en brouillon
- Classification : `CONTENT_ONLY`
- Projet fil rouge : SourceLab, dépôt externe à LearnX
- Durée indicative : 56 jours / 60 heures

## Finalité

Former un AI Product Engineer TypeScript capable de construire des fonctionnalités IA mesurées et contrôlables à partir du socle SourceLab, sans attendre Python ni masquer la complexité derrière un framework.

## Résultat attendu

À la fin, l’apprenant démontre Program Builder et Assessment Reviewer sur des datasets versionnés, avec retrieval inspectable, sorties structurées, citations, abstention, escalade humaine, sécurité, traces, coûts et rapport de non-régression.

## Principes pédagogiques

- Chaque leçon produit une modification, une décision ou une preuve dans le dépôt SourceLab externe.
- Les ressources officielles sont guidées et bornées ; leur ouverture ne valide jamais la notion.
- Les contenus progressent du modèle mental vers la livraison et l’opération.
- Chaque notion obligatoire possède une mini-évaluation, chaque leçon un quiz et chaque étape une évaluation finale.
- Les scénarios distinguent faits documentés, choix d’architecture et hypothèses propres à SourceLab.
- Aucun sujet n’est ajouté uniquement pour couvrir un catalogue DevOps ou ML.

## Architecture

### Étape 1 — Cadrer les fonctionnalités IA

- Slug : `cadrer-fonctions-ia`
- Module : `produit-llm-contrats` — Produit LLM et contrats
- Charge indicative : 7 jours
- Finalité : Délimiter les deux usages IA et choisir la solution la plus simple capable de produire un résultat mesurable.

Leçons :
- Choisir où l’IA apporte réellement de la valeur (`choisir-ou-ia-apporte-valeur`)
- Concevoir des sorties structurées et versionnées (`concevoir-sorties-structurees-versionnees`)

Évaluation finale : Évaluation — Décider où utiliser l’IA dans SourceLab.

### Étape 2 — Transformer les sources en contexte

- Slug : `transformer-sources-contexte`
- Module : `ingestion-embeddings-retrieval` — Ingestion, embeddings et retrieval
- Charge indicative : 10 jours
- Finalité : Indexer des Source Packs en préservant leur structure, leur provenance et leurs permissions.

Leçons :
- Découper les documents sans perdre leur provenance (`decouper-documents-sans-perdre-provenance`)
- Construire une recherche sémantique et hybride (`construire-recherche-semantique-hybride`)

Évaluation finale : Évaluation — Construire le retriever SourceLab.

### Étape 3 — Évaluer le RAG

- Slug : `evaluer-rag`
- Module : `datasets-evals` — Datasets, métriques et non-régression
- Charge indicative : 10 jours
- Finalité : Séparer qualité du retrieval, qualité de la génération et comportement d’abstention.

Leçons :
- Créer un dataset de retrieval représentatif (`creer-dataset-retrieval-representatif`)
- Évaluer réponses, citations et abstention (`evaluer-reponses-citations-abstention`)

Évaluation finale : Évaluation — Choisir une configuration RAG sur preuves.

### Étape 4 — Construire le Program Builder

- Slug : `construire-program-builder`
- Module : `funnel-blueprint-export` — Funnel, blueprint et export LearnX
- Charge indicative : 10 jours
- Finalité : Transformer un besoin et des sources en programme LearnX traçable, révisable et validé par étapes.

Leçons :
- Transformer une demande floue en brief validé (`transformer-demande-floue-brief-valide`)
- Générer et réviser un programme LearnX (`generer-reviser-programme-learnx`)

Évaluation finale : Évaluation — Générer un programme LearnX contrôlable.

### Étape 5 — Construire l’Assessment Reviewer

- Slug : `construire-assessment-reviewer`
- Module : `correction-calibration-revue` — Correction, calibration et revue humaine
- Charge indicative : 10 jours
- Finalité : Produire un feedback structuré à partir d’une grille préexistante sans inventer de critère ni imposer une note opaque.

Leçons :
- Appliquer une grille à une réponse libre (`appliquer-grille-reponse-libre`)
- Calibrer confiance, feedback et revue humaine (`calibrer-confiance-feedback-revue-humaine`)

Évaluation finale : Évaluation — Corriger des réponses libres de manière fiable.

### Étape 6 — Sécuriser et livrer l’IA

- Slug : `securiser-livrer-ia`
- Module : `securite-observabilite-preuve` — Sécurité, observabilité et preuve professionnelle
- Charge indicative : 9 jours
- Finalité : Déployer les démonstrateurs avec isolation, traces, budgets et preuves de qualité.

Leçons :
- Résister aux injections et isoler les données (`resister-injections-isoler-donnees`)
- Observer, comparer et présenter SourceLab (`observer-comparer-presenter-sourcelab`)

Évaluation finale : Évaluation finale — Défendre SourceLab AI.

## Projet fil rouge

SourceLab est un outil autonome qui transforme des matériaux pédagogiques bruts en corpus structuré, puis utilise ce corpus pour générer des programmes et proposer des corrections. Le premier programme livre la boucle V1 ; le second ajoute les fonctions IA.

## Hors périmètre

- Administration Kubernetes, Terraform avancé ou métier SRE.
- Entraînement de modèles, deep learning et MLOps de modèles propriétaires.
- Accès direct à la base LearnX, publication automatique ou notation définitive sans autorité LearnX/humaine.
