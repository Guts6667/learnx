# Blueprint pédagogique — AI Product Engineer en TypeScript

## Statut

- Version : 0.1.0
- Statut : proposition initiale à valider avant authoring des leçons
- Classification : `CONTENT_ONLY`
- Programme cible : `ai-product-engineer-typescript`
- Public : Product Engineer ou développeur TypeScript expérimenté souhaitant
  construire des produits LLM fiables sans dépendre de Python
- Langue principale : français ; ressources officielles en anglais admises
- Rythme cible : sept semaines, cinq à six heures par semaine
- Volume indicatif : 40 heures, hors approfondissements facultatifs
- Projet fil rouge : phase IA de **Grounded Inspector**, puis connecteur LearnX
- État d’intégration : blueprint uniquement ; aucun seed et aucune modification
  technique du moteur LearnX

Ce document décrit la carte cible du programme. Il ne remplace ni les futures
`PEDAGOGY_SPEC_XXX.json`, ni les évaluations détaillées, ni le bundle de seed.
Les titres, slugs, durées et séquences deviennent contraignants seulement après
validation de ce blueprint puis intégration explicite.

## 1. Séparation avec le programme de gouvernance IA

Ce parcours ne réutilise pas le programme
`pilotage-projets-ia-iso-42001` comme base. Les deux programmes répondent à des
besoins différents :

- `pilotage-projets-ia-iso-42001` : cadrage, gouvernance, risques, conseil et
  système de management ;
- `ai-product-engineer-typescript` : conception, implémentation, évaluation,
  observabilité et exploitation d’une fonctionnalité IA.

Quelques définitions générales peuvent s’appuyer sur les mêmes sources
primaires. Les objectifs, cas, exercices, évaluations et livrables restent
indépendants.

## 2. Besoin apprenant retenu

L’apprenant sait déjà :

- construire des expériences produit avec React ou Preact et TypeScript ;
- travailler avec une API, une base de données et Git ;
- cadrer un problème utilisateur et arbitrer un périmètre ;
- lire une architecture et collaborer avec des ingénieurs ;
- utiliser ponctuellement un modèle génératif ou un outil d’IA.

Son profil ne prouve pas encore qu’il sait :

- concevoir un pipeline d’ingestion et de retrieval ;
- expliquer les embeddings et leurs limites ;
- choisir et tester une stratégie de chunking ;
- distinguer échec du corpus, du retrieval, du prompt et du modèle ;
- imposer citations et abstention ;
- évaluer un système non déterministe ;
- tracer qualité, coût et latence ;
- améliorer un RAG avec une baseline et non à l’intuition ;
- sécuriser les frontières entre sources, utilisateurs, outils et modèle ;
- décider quand utiliser un workflow déterministe ou un agent ;
- relier ces compétences à une fonctionnalité LearnX crédible.

## 3. Finalité et résultats d’apprentissage

À l’issue du parcours, l’apprenant doit pouvoir :

1. expliquer les rôles respectifs du modèle, du contexte, des outils, des données
   et de l’application ;
2. construire un appel LLM typé avec sorties structurées, streaming, erreurs et
   limites explicites ;
3. estimer et observer tokens, coût et latence ;
4. concevoir un pipeline d’import versionné et rejouable ;
5. comparer plusieurs stratégies de chunking sur des cas réels ;
6. expliquer un embedding, une distance, un score et les limites d’une recherche
   sémantique ;
7. stocker et interroger des embeddings dans PostgreSQL avec `pgvector` ;
8. construire une baseline de recherche vectorielle exacte ;
9. assembler un contexte, générer une réponse sourcée et refuser de répondre
   lorsque les preuves sont insuffisantes ;
10. conserver une trace complète reliant question, corpus, configuration,
    retrieval, prompt, génération et évaluation ;
11. construire un dataset représentatif comportant questions répondables,
    non répondables, ambiguës et contradictoires ;
12. mesurer retrieval, pertinence, correction, groundedness, citations et
    abstention ;
13. comparer recherche exacte, index approximatif, recherche lexicale,
    recherche hybride et reranking ;
14. détecter une régression lorsqu’un corpus, un prompt, un modèle ou une
    configuration change ;
15. concevoir un outil typé et un workflow borné avant d’introduire une boucle
    agentique ;
16. limiter appels d’outils, itérations, permissions et actions sensibles ;
17. traiter prompt injection, fuite de données, filtrage de portée et contenu
    non fiable à un niveau applicatif ;
18. importer un programme LearnX en lecture seule avec ses métadonnées ;
19. analyser la qualité par programme, étape, module et leçon ;
20. défendre les choix du système en reliant qualité, valeur produit, coût,
    latence, sécurité et complexité opérationnelle.

## 4. Prérequis et articulation avec le programme Engineering

Le programme suppose les compétences suivantes :

- TypeScript courant ;
- API HTTP et validation serveur ;
- PostgreSQL, migrations et transactions de base ;
- Docker Compose ;
- tests unitaires et d’intégration ;
- logs, timeouts, erreurs normalisées et variables d’environnement.

Elles peuvent être acquises dans
`engineering-foundations-product-engineers` ou démontrées par un diagnostic
initial. Le programme IA ne répète pas les leçons Docker, HTTP ou SQL généralistes.
Il les mobilise dans le projet.

Python n’est pas requis. Les exemples et livrables sont réalisés en TypeScript.
Une ressource en Python peut être proposée seulement si elle apporte une idée
transférable et si une alternative TypeScript ou une explication indépendante
est fournie.

## 5. Positionnement et limites

Le parcours vise le rôle d’AI Product Engineer ou Product Engineer spécialisé
dans les fonctionnalités IA. Il ne prépare pas à :

- entraîner un modèle de fondation ;
- devenir ML Researcher ou Data Scientist ;
- maîtriser PyTorch, CUDA ou l’optimisation distribuée ;
- construire une plateforme universelle d’observabilité LLM ;
- remplacer un spécialiste sécurité, données ou MLOps ;
- supposer qu’un agent est la solution par défaut ;
- déclarer une qualité « production-ready » sans dataset ni mesure.

Le fine-tuning est situé par rapport au RAG et aux prompts, mais il ne constitue
pas un projet du parcours. L’objectif est de savoir reconnaître le problème
qu’il pourrait résoudre, pas d’entraîner un modèle.

## 6. Principes pédagogiques

1. **Baseline avant optimisation.** La recherche exacte et un pipeline simple
   sont mesurés avant HNSW, recherche hybride ou reranking.
2. **Inspection avant abstraction.** Les premières versions utilisent des
   fonctions et interfaces explicites avant l’ajout éventuel d’un framework.
3. **Corpus, retrieval et génération sont évalués séparément.**
4. **L’abstention est une capacité positive**, pas seulement une absence de
   réponse.
5. **Une citation doit soutenir l’affirmation**, pas seulement pointer vers un
   document voisin.
6. **Chaque run est reproductible** par corpus et configuration versionnés.
7. **Les outils et agents sont bornés** par schémas, permissions, nombre
   d’itérations, timeouts et validation humaine.
8. **Le connecteur LearnX est en lecture seule** avant toute intégration runtime.
9. **Les métriques servent une décision.** Aucun dashboard décoratif n’est
   requis.
10. **Les échecs deviennent des cas de régression.**

Les activités productives utilisent les types LearnX existants :

- `practice` pour les implémentations ciblées ;
- `writing` et `reflection` pour les analyses et décisions ;
- `project` pour les incréments Grounded ;
- `reading`, `watching`, `listening` et `checklist` pour les supports sans
  production ;
- mini-évaluations obligatoires et évaluation finale de chaque étape.

## 7. Projet fil rouge — Grounded Inspector, phase IA

Le contrat complet du projet se trouve dans
`../engineering-foundations-product-engineers/GROUNDED_INSPECTOR_PROJECT.md`.

Le programme reprend une version `engineering-ready` disposant déjà de :

- corpus et sources ;
- API TypeScript ;
- PostgreSQL ;
- import `.md` et `.txt` ;
- Docker Compose ;
- tests et CI ;
- logs, santé et erreurs normalisées.

Il ajoute progressivement :

```text
normalisation et chunking
→ embeddings
→ recherche vectorielle exacte
→ contexte et réponse sourcée
→ inspecteur de runs
→ datasets et expériences
→ recherche hybride et reranking
→ outils et workflows
→ connecteur LearnX en lecture seule
```

## 8. Livrable professionnel cumulatif

Le programme aboutit à un dossier portfolio comprenant :

- application Grounded démontrable ;
- diagramme du pipeline RAG ;
- modèle de données des corpus, chunks, runs et expériences ;
- stratégie de chunking et résultats comparatifs ;
- baseline de retrieval exact ;
- contrat de citation et d’abstention ;
- inspecteur de runs ;
- dataset de référence ;
- rapport d’évaluation ;
- comparaison qualité, coût et latence de plusieurs configurations ;
- threat model RAG et contrôles ;
- connecteur JSON LearnX ;
- heatmap de qualité par unité pédagogique ;
- ADR sur l’intégration future à LearnX ;
- README technique ;
- étude de cas produit expliquant les hypothèses, échecs, arbitrages et limites.

## 9. Architecture cible du programme

### Étape 1 — Construire une application LLM contrôlable

- Slug cible : `construire-application-llm-controlable`
- Charge indicative : 5 h
- Finalité : traiter un modèle comme une dépendance externe non déterministe,
  avec contrat, erreurs et mesures.

Module `fondations-applications-llm` — Modèle, contexte et contrat

- Distinguer modèle, application, contexte et outils
  (`distinguer-modele-application-contexte-outils`)
- Produire des sorties structurées et validées
  (`produire-sorties-structurees-validees`)
- Encadrer streaming, erreurs, tokens, coût et latence
  (`encadrer-appels-llm`)

Évaluation finale : implémenter dans Grounded un premier appel LLM non-RAG qui
résume un texte fourni, avec schéma de sortie, validation, timeout, gestion
d’erreur, mesure des tokens et trace minimale. L’apprenant doit expliquer
pourquoi cette fonctionnalité n’est pas encore un RAG.

Contribution au projet : adaptateur modèle, configuration versionnée, structure
de run et premier écran de trace.

### Étape 2 — Ingestérer, découper et représenter un corpus

- Slug cible : `ingerer-decouper-representer-corpus`
- Charge indicative : 6 h
- Finalité : transformer des sources versionnées en unités récupérables sans
  perdre leur provenance.

Module `ingestion-chunking-embeddings` — De la source au vecteur

- Concevoir un pipeline d’ingestion versionné et rejouable
  (`concevoir-pipeline-ingestion-versionne`)
- Comparer des stratégies de chunking
  (`comparer-strategies-chunking`)
- Comprendre et stocker des embeddings
  (`comprendre-stocker-embeddings`)

Évaluation finale : importer un petit corpus, produire des chunks traçables,
comparer au moins deux tailles ou stratégies sur des questions préparées, puis
générer et stocker les embeddings avec métadonnées de modèle et version.

Contribution au projet : SourceVersion, Chunk, Embedding, écran d’inspection et
visualisation de distribution.

### Étape 3 — Construire un RAG sourcé et capable de s’abstenir

- Slug cible : `construire-rag-source-abstention`
- Charge indicative : 6 h
- Finalité : établir une baseline complète et inspectable avant toute optimisation.

Module `retrieval-generation` — Recherche, contexte et citations

- Construire une recherche vectorielle exacte
  (`construire-recherche-vectorielle-exacte`)
- Sélectionner et assembler un contexte
  (`selectionner-assembler-contexte`)
- Générer une réponse sourcée et s’abstenir
  (`generer-reponse-sourcee-abstention`)

Évaluation finale : livrer un pipeline question → embedding → top-k exact →
contexte → réponse, avec citations vers les chunks, filtres de corpus, seuil ou
règle d’insuffisance et trois cas où le système doit refuser de répondre.

Contribution au projet : Playground RAG, RetrievalHit, ContextItem, Citation et
politique d’abstention.

### Étape 4 — Observer et évaluer le système

- Slug cible : `observer-evaluer-systeme-rag`
- Charge indicative : 7 h
- Finalité : remplacer les impressions par des traces, datasets et mesures
  reproductibles.

Module `observabilite-evaluations` — Runs, cas de test et expériences

- Instrumenter un run de bout en bout
  (`instrumenter-run-rag`)
- Construire un dataset représentatif
  (`construire-dataset-evaluation`)
- Mesurer retrieval, réponse, citations et abstention
  (`mesurer-qualite-rag`)

Évaluation finale : construire un dataset comportant questions répondables,
non répondables, ambiguës et reformulées ; exécuter une expérience ; produire
un rapport séparant erreurs du corpus, du retrieval et de la génération ;
documenter les limites des évaluateurs automatiques.

Contribution au projet : Run Inspector, EvaluationDataset, Experiment et
premier dashboard qualité/coût/latence.

### Étape 5 — Améliorer le retrieval sans perdre la baseline

- Slug cible : `ameliorer-retrieval-baseline`
- Charge indicative : 6 h
- Finalité : introduire chaque optimisation comme une hypothèse mesurable.

Module `retrieval-avance` — Index, hybridation et reranking

- Comparer recherche exacte et index approximatif
  (`comparer-exact-hnsw`)
- Construire une recherche lexicale et hybride
  (`construire-recherche-hybride`)
- Appliquer reranking, transformation et seuils
  (`appliquer-reranking-transformation`)

Évaluation finale : comparer au moins trois configurations sur le même dataset,
mesurer rappel, rang, groundedness, coût et latence, puis recommander une
configuration avec les compromis explicités. La baseline exacte doit rester
exécutable pour contrôler le rappel de l’index approximatif.

Contribution au projet : stratégies de retrieval versionnées, comparaison
d’expériences et visualisation qualité/coût.

### Étape 6 — Construire des workflows et agents bornés

- Slug cible : `construire-workflows-agents-bornes`
- Charge indicative : 5 h
- Finalité : utiliser outils et autonomie uniquement lorsque le problème ne se
  résout pas proprement par un workflow déterministe.

Module `outils-workflows-agents` — Actions typées et contrôle

- Concevoir un outil typé et une autorisation explicite
  (`concevoir-outil-type-autorise`)
- Orchestrer un workflow déterministe et persistant
  (`orchestrer-workflow-deterministe`)
- Encadrer une boucle agentique et l’approbation humaine
  (`encadrer-boucle-agentique`)

Évaluation finale : ajouter à Grounded un workflow de création d’un cas de test
à partir d’un run sélectionné, puis comparer une version déterministe à une
version agentique limitée. L’apprenant doit justifier le choix final, borner
itérations et outils, et démontrer le comportement en cas d’échec ou de demande
non autorisée.

Contribution au projet : registre d’outils, schémas Zod, états de workflow,
limites d’itération, approbation et journal des actions.

### Étape 7 — Sécuriser, versionner et connecter LearnX

- Slug cible : `securiser-versionner-connecter-learnx`
- Charge indicative : 5 h
- Finalité : démontrer une utilité réelle pour LearnX sans coupler les dépôts ni
  masquer les risques du RAG.

Module `production-et-integration-learnx` — Portée, versions et contrat

- Traiter prompt injection, données non fiables et permissions
  (`traiter-prompt-injection-permissions`)
- Versionner corpus, prompts, modèles et expériences
  (`versionner-corpus-configurations`)
- Importer et analyser un programme LearnX
  (`importer-analyser-programme-learnx`)

Évaluation finale : importer un programme LearnX JSON en lecture seule, conserver
programme, étape, module, leçon et clés de contenu comme métadonnées, exclure les
réponses d’évaluation du corpus de test, exécuter un dataset par portée et
produire une heatmap. Le dossier final contient aussi une ADR proposant ou
refusant une future intégration runtime avec sécurité, coût, latence, fallback
et rollback.

Contribution au projet : connecteur LearnX, comparaison de versions, filtres de
portée et capstone portfolio.

## 10. Stratégie d’évaluation

### 10.1 Mini-évaluations de notion

Les types actuels sont utilisés selon le besoin :

- `quiz` pour distinguer concepts et modes d’échec ;
- `short_answer` pour expliquer une métrique ou un compromis ;
- `case_question` pour diagnostiquer un run ;
- `practice` pour lire un résultat de retrieval, une trace ou une configuration ;
- `flashcard` avec parcimonie pour les termes indispensables.

Les questions évitent de récompenser le vocabulaire sans compréhension. Les
cas demandent par exemple d’identifier si une réponse fausse vient d’une source
absente, d’un mauvais chunk, d’un retrieval insuffisant ou d’une génération non
fondée.

### 10.2 Évaluations d’étape

Types cibles :

- étape 1 : `practical_exercise` ;
- étape 2 : `practical_exercise` ;
- étape 3 : `project` ;
- étape 4 : `case_study` ;
- étape 5 : `case_study` ;
- étape 6 : `simulation` ;
- étape 7 : `project`.

Le seuil cible est 70 %. Une absence de provenance, une fuite de portée, une
évaluation contaminée par les réponses attendues ou une citation non soutenue
constitue une faiblesse bloquante à remédier.

### 10.3 Dataset d’évaluation pédagogique

Le projet comporte son propre dataset technique. Il ne remplace pas les banques
de questions LearnX. Les deux objets sont séparés :

- banques LearnX : valider la maîtrise de l’apprenant ;
- dataset Grounded : valider le comportement du système RAG.

Pour éviter une fuite de test, les réponses, explications et options correctes
des évaluations LearnX ne sont pas indexées dans le corpus utilisé pour tester
le tuteur.

## 11. Métriques enseignées

### Retrieval

- hit rate dans le top-k ;
- recall sur un ensemble de sources attendues ;
- Mean Reciprocal Rank lorsque pertinent ;
- précision des chunks récupérés ;
- rappel approximatif comparé à la recherche exacte ;
- taux de requêtes sans résultat suffisant.

### Réponse

- pertinence ;
- correction ;
- groundedness ;
- couverture et exactitude des citations ;
- abstention correcte ;
- proportion d’affirmations non soutenues.

### Opérationnel

- latence totale, médiane et p95 ;
- durée par étape ;
- tokens d’entrée et de sortie ;
- coût estimé ;
- taux d’erreur ;
- débit d’ingestion et durée d’expérience.

Aucune métrique n’est présentée comme universelle. Sa définition, son calcul,
son jeu de données et ses limites sont documentés.

## 12. Sécurité et responsabilité applicative

Le programme traite au minimum :

- contenu importé considéré comme non fiable ;
- séparation instructions, données et sorties ;
- prompt injection directe et indirecte ;
- validation des schémas d’outils ;
- moindre privilège ;
- filtrage de corpus et de portée avant retrieval ;
- secrets et clés fournisseurs ;
- journalisation sans exposition inutile du contenu ;
- rétention et suppression ;
- limites d’upload ;
- timeouts, rate limits et contrôle des coûts ;
- approbation humaine avant action sensible.

Le parcours ne promet pas une protection absolue. Il apprend à modéliser les
menaces, réduire l’exposition et prévoir le comportement sûr en cas de doute.

## 13. Sources de cadrage prévues

Les leçons privilégieront les sources primaires et officielles :

- documentation du fournisseur utilisé pour embeddings, sorties structurées,
  tools, tokens et API ;
- documentation PostgreSQL et dépôt officiel `pgvector` pour stockage,
  recherche exacte, HNSW, filtrage et recherche hybride ;
- documentation OpenTelemetry pour traces, métriques, logs et conventions GenAI ;
- documentation Langfuse ou LangSmith uniquement lorsqu’une fonctionnalité de
  ces outils est réellement enseignée ou comparée ;
- OWASP pour les risques LLM, API, fichiers et secrets ;
- articles scientifiques originaux ou benchmarks lorsque le contenu affirme un
  résultat sur une méthode d’évaluation ou de retrieval.

Les pages marketing, tutoriels SEO et exemples non maintenus ne servent pas de
source centrale. Les modèles, tarifs, limites et APIs étant susceptibles de
changer, leurs détails seront revérifiés avant publication et ne seront pas
encodés comme vérités durables lorsque ce n’est pas nécessaire.

## 14. Compatibilité avec le modèle LearnX actuel

Le programme n’exige aucun nouveau champ, enum ou type d’activité. Il utilise :

```text
Program
└── Stage + StageAssessment
    └── Module
        └── Lesson
            ├── contentBlocks
            ├── resources
            ├── concepts + assessment
            ├── tasks / exercises
            ├── quizzes
            └── sequence
```

Règles bloquantes :

- chaque leçon complète possède résumé, objectifs, prérequis, durée et séquence ;
- les blocs factuels sont sourcés ;
- `sourceKeys` ne référencent que des ressources de la même leçon ;
- chaque notion obligatoire possède une ressource et une évaluation ;
- les activités productives sont des exercices, jamais des tâches binaires en
  doublon ;
- chaque élément canonique apparaît exactement une fois dans la séquence ;
- chaque étape possède une évaluation finale ;
- toutes les clés sont stables ;
- le programme reste `draft` avant contrôles éditoriaux, pédagogiques et
  techniques.

Les visualisations Grounded ne nécessitent aucun nouveau type de contenu LearnX.
Elles sont produites dans le dépôt externe et remises comme livrables de type
`practice` ou `project`.

## 15. Plan d’authoring

1. Valider ce blueprint et le projet Grounded.
2. Vérifier ou authorer le diagnostic de prérequis Engineering.
3. Réserver les identifiants globaux des spécifications et évaluations.
4. Authorer l’étape 1 comme lot pilote complet.
5. Construire en parallèle le squelette externe de Grounded.
6. Valider la charge réelle, les sources et la faisabilité TypeScript.
7. Authorer les étapes 2 à 7 par lots autonomes.
8. Générer le bundle de seed en statut `draft`.
9. Ajouter le lecteur du seed et les tests dans une modification technique
   séparée.
10. Exécuter les contrôles JSON, lint, typecheck, tests et import isolé.
11. Décider explicitement de la publication.

La future intégration runtime entre Grounded et LearnX est hors de ce lot
pédagogique. Elle nécessitera une ADR, un ticket technique et une validation
séparée.