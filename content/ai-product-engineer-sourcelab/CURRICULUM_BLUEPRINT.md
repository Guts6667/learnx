# Blueprint pédagogique — AI Product Engineer — RAG et évaluation pour SourceLab

## Statut

- Version : 1.0.0
- Statut : brouillon privé
- Classification : `CONTENT_ONLY` pour le contenu ; l’enregistrement du seed utilise le mécanisme existant sans migration
- Programme cible : `ai-product-engineer-sourcelab`
- Public : Product Engineer TypeScript ayant terminé SourceLab V1 ou possédant un niveau équivalent en backend, Docker, tests et exploitation.
- Rythme cible : Six semaines, sept à neuf heures par semaine, environ 50 à 60 heures
- Projet fil rouge : SourceLab, dépôt autonome séparé de LearnX
- Date de création : 18 août 2026

## 1. Finalité

Ce parcours part d’un produit déjà fiable pour apprendre l’AI Product Engineering par deux usages LearnX strictement délimités : la création assistée de programmes et la correction assistée de textes libres. Il privilégie datasets, retrieval, contrôles, sécurité et preuve de qualité avant les agents ou l’autonomie.

## 2. Résultats d’apprentissage

1. cadrer un usage IA en contrat produit, baseline, risques et gates ;
2. ingérer des matériaux hétérogènes en conservant provenance et limites ;
3. comparer chunking, embeddings, recherche lexicale, vectorielle et hybride ;
4. mesurer retrieval, génération, abstention, coût et latence sur des datasets versionnés ;
5. construire un funnel, un brief et un pipeline de génération LearnX contrôlé ;
6. proposer une correction par rubrique, calibrer l’escalade et préserver la décision humaine ;
7. résister aux prompt injections, fuites et modifications non autorisées ;
8. promouvoir une configuration IA uniquement lorsque les gates offline, staging et sécurité passent.

## 3. Résultat produit et versions

Le parcours ajoute à SourceLab V1 deux démonstrateurs :

**Program Builder**
- import de matériaux ;
- funnel adaptatif ;
- brief validé ;
- blueprint ;
- génération progressive de leçons ;
- modification ciblée avec sections verrouillées ;
- export JSON compatible LearnX.

**Assessment Reviewer**
- consigne, rubrique, notions et réponse ;
- retrieval du contexte autorisé ;
- jugement par critère ;
- score proposé calculé hors modèle ;
- feedback et citations ;
- routing vers feedback automatique, confirmation ou revue humaine.

La couche commune comprend ingestion, chunks, embeddings, retrieval hybride, datasets, traces, coûts, sécurité et versionnement.

## 4. Frontière d’architecture

```text
Dépôt LearnX                         Dépôt SourceLab
programme et progression             code, base, fichiers et expériences
        │                                      │
        └──── export/API versionné ────────────┘
```

SourceLab ne se connecte jamais directement à la base LearnX. LearnX reste la source de vérité des programmes publiés, utilisateurs, progressions, soumissions et décisions finales. Les livrables du parcours sont réalisés dans SourceLab ; LearnX ne reçoit que des artefacts explicitement validés.

## 5. Architecture du parcours

### Étape 1 — Cadrer la qualité avant le modèle

- Slug : `cadrer-qualite-ia`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Définir les contrats et preuves IA
- Leçons :
  - Définir les deux usages IA et leurs limites (`definir-usages-ia-limites`)
  - Construire les datasets et gates d’évaluation (`construire-datasets-gates-evaluation`)

**Livrable d’étape :** Note produit-technique, matrice de risques, dataset versionné et tableau des gates.

### Étape 2 — Ingérer et structurer les sources

- Slug : `ingerer-et-structurer-sources`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Produire un corpus traçable
- Leçons :
  - Extraire le contenu sans perdre la provenance (`extraire-contenu-provenance`)
  - Comparer des stratégies de chunking (`comparer-strategies-chunking`)

**Livrable d’étape :** Pipeline, corpus de test, artefacts de provenance, rapport de chunking et export Source Pack.

### Étape 3 — Retrouver les bons passages

- Slug : `retrouver-bons-passages`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Construire le retriever SourceLab
- Leçons :
  - Implémenter embeddings et recherche vectorielle (`implementer-embeddings-recherche-vectorielle`)
  - Construire une recherche hybride et un reranking (`construire-recherche-hybride-reranking`)

**Livrable d’étape :** Service de retrieval, requêtes SQL, dataset, rapport comparatif et tests d’isolation.

### Étape 4 — Générer des programmes sourcés

- Slug : `generer-programmes-sources`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Générer un programme LearnX contrôlé
- Leçons :
  - Construire le funnel et valider le brief (`construire-funnel-valider-brief`)
  - Générer un blueprint et modifier sans dérive (`generer-blueprint-modifier-sans-derive`)

**Livrable d’étape :** Historique funnel, brief, blueprint, PEDAGOGY_SPEC brouillon, rapport de validation et diff ciblé.

### Étape 5 — Corriger les textes libres avec prudence

- Slug : `corriger-textes-libres`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Proposer une correction fiable
- Leçons :
  - Appliquer une rubrique avec une sortie structurée (`appliquer-rubrique-sortie-structuree`)
  - Calibrer confiance, cohérence et revue humaine (`calibrer-confiance-revue-humaine`)

**Livrable d’étape :** Service Assessment Reviewer, dataset annoté, rapport d’accord/biais, règles de routing et journal de revue.

### Étape 6 — Sécuriser et mettre en production

- Slug : `securiser-et-mettre-production`
- Durée indicative : 7 jours
- Évaluation : Évaluation finale — Défendre et livrer SourceLab IA
- Leçons :
  - Résister aux injections et aux fuites de données (`resister-injections-fuites-donnees`)
  - Livrer, observer et décider la promotion (`livrer-observer-decider-promotion`)

**Livrable d’étape :** Threat model, suite red team, traces sûres, tableau de bord qualité/coût/latence, rapport go/no-go et runbook.

## 6. Progression pédagogique

Chaque étape suit la boucle : contenu sourcé → mise en situation SourceLab → production dans le dépôt externe → mini-évaluation de notion → quiz de transfert → évaluation finale d’étape.

Les deux leçons d’une étape construisent un même incrément. L’évaluation finale ne demande pas une production sans préparation : elle assemble, met sous contrainte et vérifie les livrables réalisés dans les leçons.

## 7. Hors périmètre

- chatbot généraliste pour discuter avec tous les cours ;
- entraînement d’un modèle de fondation ou MLOps de modèles propriétaires ;
- publication automatique d’un programme LearnX ;
- écriture automatique d’une note définitive ou de la progression dans LearnX ;
- base de données partagée entre SourceLab et LearnX ;
- architecture multi-agent complexe avant une preuve de besoin.

## 8. Stratégie de sources

Les sources principales sont les documentations OpenAI sur embeddings, retrieval, sorties structurées et evals, pgvector et PostgreSQL pour la recherche, les contrats éditoriaux LearnX, NIST AI RMF, OWASP et OpenTelemetry. Les comportements dépendant d’un fournisseur restent isolés et doivent être revalidés à chaque changement de modèle ou d’API.

Les documentations évolutives sont datées au 18 août 2026. Le statut `draft` reste bloquant tant qu’une personne n’a pas rouvert chaque URL, contrôlé le périmètre demandé et vérifié que l’exercice correspond encore au comportement documenté.

## 9. Critères de complétion du programme

- toutes les productions obligatoires sont présentes dans le dépôt SourceLab ;
- les mini-évaluations de notions et quiz atteignent leur seuil ;
- chaque évaluation d’étape atteint 70 % ;
- les tests, mesures ou démonstrations demandés sont reproductibles ;
- les limites et échecs restent documentés ;
- aucun livrable ne suppose une modification directe du repo ou de la base LearnX.

## 10. Revue requise

Avant publication : revue technique par un ingénieur expérimenté du domaine, revue pédagogique de l’alignement objectifs-activités-évaluations, contrôle des liens et essai du rythme par l’apprenant. Le contenu ne revendique ni validation scientifique ni certification professionnelle.
