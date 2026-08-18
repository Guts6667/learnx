# Projet fil rouge — Grounded Inspector

## Statut

- Version : 0.1.0
- Statut : vision validée, périmètre initial à construire
- Nature : projet externe partagé par deux programmes LearnX
- Dépôt cible : dépôt Git distinct de `Guts6667/learnx`
- Programmes consommateurs :
  - `engineering-foundations-product-engineers` ;
  - `ai-product-engineer-typescript`.
- Relation à LearnX : import en lecture seule d’un programme JSON, puis API
  consommable ultérieurement ; aucune écriture dans LearnX au départ

## 1. Vision

Grounded Inspector est un petit laboratoire RAG visuel permettant de :

1. importer et versionner un corpus documentaire ;
2. comprendre comment ce corpus est normalisé et découpé ;
3. construire un pipeline RAG en TypeScript ;
4. inspecter chaque étape d’une réponse ;
5. mesurer qualité, coût et latence ;
6. comparer des configurations sur des cas de test reproductibles ;
7. analyser ultérieurement les contenus d’un programme LearnX sans modifier son
   dépôt ou sa base de données.

Le produit n’est pas un simple « chat avec un PDF ». Le chat est une surface de
test. La valeur centrale est l’explication observable du pipeline : sources,
chunks, scores, contexte, génération, citations, abstention et évaluations.

## 2. Utilisateurs et problèmes

### 2.1 Utilisateur initial

Le premier utilisateur est le développeur du projet. Il cherche à apprendre le
RAG et à diagnostiquer ses choix sans dépendre d’une plateforme opaque.

Besoins :

- savoir pourquoi une réponse est correcte ou incorrecte ;
- distinguer un échec de retrieval d’un échec de génération ;
- comparer deux stratégies sans se fier à quelques démonstrations réussies ;
- suivre tokens, coût et latence ;
- conserver les cas problématiques comme tests de régression.

### 2.2 Utilisateur LearnX ultérieur

Le second utilisateur est l’auteur ou responsable d’un programme LearnX.

Besoins :

- importer une version d’un programme ;
- vérifier la couverture documentaire par étape, module et leçon ;
- tester des questions répondables et non répondables ;
- identifier les contenus difficiles à récupérer ou à citer ;
- comparer la qualité avant et après une révision éditoriale ;
- fournir plus tard un moteur observable à un tuteur LearnX.

## 3. Principes de conception

1. **Petit monolithe modulaire avant tout découpage distribué.**
2. **Une seule base PostgreSQL** au départ, avec `pgvector` ajouté dans la phase
   IA.
3. **TypeScript de bout en bout.** Python n’est pas requis.
4. **Une seule implémentation par capacité** au MVP : un fournisseur de modèle,
   une stratégie de chunking, une stratégie de retrieval.
5. **Observabilité intégrée dès la première requête**, sans recréer une plateforme
   générique comme Langfuse.
6. **Configurations versionnées** afin de relier une réponse à un corpus, un
   prompt, un modèle et des paramètres précis.
7. **Aucune connexion implicite à LearnX.** Le premier connecteur reçoit un
   fichier JSON sélectionné ou copié manuellement.
8. **Pas d’agent avant un RAG déterministe et évalué.**
9. **Pas de visualisation décorative.** Un graphique doit aider à décider ou à
   diagnostiquer.
10. **Les échecs de production deviennent des cas de test.**

## 4. Périmètre du produit

### 4.1 Capacités cibles

```text
Corpus
├── Sources
├── Versions
└── Chunks

Playground
├── Question
├── Configuration
├── Retrieval
├── Contexte
└── Réponse sourcée

Runs
├── Timeline
├── Erreurs
├── Tokens
├── Coût
└── Feedback

Evaluations
├── Datasets
├── Cas de test
├── Expériences
└── Comparaisons

Integrations
└── LearnX JSON
```

### 4.2 Hors périmètre initial

- authentification et multi-tenant ;
- facturation ;
- collaboration en équipe ;
- crawling d’un site entier ;
- connecteurs Notion, Google Drive ou YouTube ;
- OCR et PDF scannés ;
- multiples fournisseurs de modèles ;
- orchestration multi-agent ;
- alerting d’entreprise ;
- Kubernetes, Redis et queue distribuée ;
- visualisation 3D d’embeddings ;
- édition des programmes LearnX depuis Grounded.

## 5. Incréments du projet

Le projet est découpé en incréments utilisables. Chaque incrément doit pouvoir
être démontré, testé et arrêté sans rendre les précédents inutiles.

### Incrément E0 — Décision et squelette

Produit par le programme Engineering, étape 1.

Livrables :

- problème et non-objectifs ;
- diagramme de contexte ;
- monolithe modulaire ;
- structure du dépôt ;
- ADR sur PostgreSQL et l’absence de microservices ;
- commandes de démarrage minimales.

Aucune IA et aucun import de fichier ne sont requis.

### Incrément E1 — Corpus et sources déterministes

Produit par le programme Engineering, étape 2.

Fonctions :

- créer un corpus ;
- ajouter une source par texte collé, `.md` ou `.txt` ;
- stocker le fichier ou le texte d’origine ;
- normaliser le texte ;
- afficher le statut d’import ;
- relancer un import échoué ;
- supprimer une source ;
- conserver une nouvelle version si le contenu change.

L’indexation est simulée ou limitée au stockage du texte. Il n’y a pas encore
d’embedding.

### Incrément E2 — Environnement reproductible

Produit par le programme Engineering, étapes 3 et 4.

Fonctions et preuves :

- API et PostgreSQL démarrés localement ;
- Dockerfile multi-stage ;
- `compose.yaml` ;
- volume persistant ;
- réseau interne ;
- variables documentées ;
- healthchecks ;
- migration explicite ;
- scénarios de panne reproductibles.

### Incrément E3 — Version Engineering livrable

Produit par le programme Engineering, étapes 5 et 6.

Fonctions et preuves :

- CI ;
- tests unitaires et d’intégration ;
- logs structurés ;
- identifiant de corrélation ;
- métriques de base ;
- endpoint de santé ;
- timeouts et erreurs normalisées ;
- validation et limites d’import ;
- README d’exploitation ;
- incident simulé et corrigé.

Cette version est utile comme gestionnaire de corpus même sans IA.

### Incrément A1 — Chunking inspectable

Produit par le programme AI Product Engineer, étape 2.

Fonctions :

- découper une version de source ;
- stocker chaque chunk avec sa position, sa taille et ses métadonnées ;
- afficher le texte et les frontières ;
- réindexer avec une autre configuration ;
- visualiser la distribution des tailles ;
- relier chaque chunk à sa source et à sa version.

Formats initiaux : texte collé, `.md`, `.txt`.

### Incrément A2 — Embeddings et recherche vectorielle exacte

Fonctions :

- générer un embedding par chunk ;
- stocker les vecteurs avec `pgvector` ;
- transformer une question en embedding ;
- exécuter une recherche exacte ;
- afficher rang, distance ou score, source et chunk ;
- filtrer par corpus et métadonnées.

L’index approximatif est explicitement repoussé afin de conserver une référence
de rappel.

### Incrément A3 — Réponse sourcée et inspecteur de run

Fonctions :

- construire le contexte à partir des chunks retenus ;
- générer une réponse ;
- citer les sources ;
- s’abstenir lorsque les preuves sont insuffisantes ;
- stocker un `RagRun` complet ;
- afficher la timeline, les chunks, le contexte final, tokens, coût et latence ;
- recueillir un feedback simple.

### Incrément A4 — Datasets et expériences

Fonctions :

- enregistrer une question comme cas de test ;
- indiquer les sources attendues ;
- définir si le système doit répondre ou s’abstenir ;
- exécuter un dataset sur une configuration ;
- calculer des métriques de retrieval et de réponse ;
- comparer deux expériences ;
- afficher qualité, coût et latence côte à côte.

### Incrément A5 — Recherche améliorée

Fonctions introduites une par une et comparées à la baseline :

- index HNSW ;
- recherche plein texte PostgreSQL ;
- recherche hybride ;
- fusion de rangs ;
- reranking ;
- transformation de requête ;
- seuils et politiques d’abstention.

Aucune capacité n’est conservée parce qu’elle « semble meilleure ». Elle doit
améliorer un dataset représentatif sans coût ou latence disproportionné.

### Incrément A6 — Connecteur LearnX en lecture seule

Fonctions :

- importer un fichier de programme conforme au seed LearnX ;
- extraire programme, étape, module, leçon, bloc, notion et ressource ;
- conserver les slugs et clés comme métadonnées ;
- exclure les réponses d’évaluation du corpus servant aux tests ;
- filtrer le retrieval par programme, module ou leçon ;
- afficher une heatmap de qualité par unité pédagogique ;
- relier une expérience à la version ou au checksum du programme lorsque cette
  information est disponible dans l’export ;
- n’effectuer aucune mutation dans LearnX.

### Incrément A7 — Contrat de service pour LearnX

Incrément facultatif après validation du connecteur.

Grounded expose une API serveur typée :

```text
POST /v1/query
GET  /v1/runs/:runId
POST /v1/corpora/learnx-imports
POST /v1/experiments
```

Le contrat de requête LearnX doit au minimum contenir :

- identifiant et version du corpus ;
- portée autorisée : programme, module ou leçon ;
- question ;
- identifiant de corrélation ;
- configuration approuvée.

La réponse contient :

- texte ;
- citations structurées ;
- statut d’abstention ;
- identifiant de run ;
- version du corpus ;
- informations de coût et latence destinées au monitoring, pas nécessairement à
  l’interface apprenant.

Cette API n’est intégrée à LearnX qu’après une décision technique séparée,
feature flag, tests de contrat et environnement de preview.

## 6. Parcours utilisateur du MVP RAG

```text
1. Créer un corpus
2. Importer deux fichiers Markdown ou texte
3. Voir les sources et leurs versions
4. Inspecter les chunks
5. Poser une question
6. Lire la réponse et ses citations
7. Ouvrir le run
8. Voir les chunks récupérés et leurs scores
9. Voir le contexte réellement envoyé
10. Lire tokens, coût et latence
11. Tester une question absente du corpus
12. Enregistrer les deux questions dans un dataset
13. Comparer deux tailles de chunks ou deux valeurs de top-k
```

Ce parcours constitue la définition fonctionnelle du premier portfolio RAG.

## 7. Écrans cibles

### 7.1 Sources

Affiche :

- corpus ;
- source et type ;
- version ;
- taille ;
- statut ;
- nombre de chunks ;
- erreur éventuelle ;
- actions de réindexation et suppression.

Visualisation autorisée : distribution des tailles de chunks. Elle doit signaler
les valeurs atypiques, pas seulement dessiner un histogramme.

### 7.2 Playground

Affiche :

- question ;
- portée du corpus ;
- configuration ;
- réponse ;
- citations ;
- statut d’abstention ;
- lien vers le run.

### 7.3 Run Inspector

Affiche :

- chronologie des étapes ;
- durée de chaque étape ;
- requête de retrieval ;
- résultats classés ;
- chunks retenus et exclus ;
- contexte final ;
- modèle, prompt et paramètres versionnés ;
- tokens, coût, latence et erreurs ;
- feedback et scores d’évaluation.

### 7.4 Evaluations

Affiche :

- datasets ;
- cas répondables et non répondables ;
- source ou chunk attendu ;
- expériences ;
- comparaison de configurations ;
- résultats détaillés et agrégés.

### 7.5 Dashboard LearnX

Après A6 uniquement :

- qualité par programme, étape, module et leçon ;
- questions sans source retrouvée ;
- citations insuffisantes ;
- abstentions incorrectes ;
- différence entre deux versions du programme.

## 8. Modèle conceptuel minimal

```text
Corpus
└── Source
    └── SourceVersion
        └── Chunk
            └── Embedding

RagConfiguration
├── chunkingVersion
├── embeddingModel
├── retrievalStrategy
├── topK
├── threshold
├── generationModel
└── promptVersion

RagRun
├── CorpusVersion
├── Query
├── RetrievalHit[]
├── ContextItem[]
├── Generation
├── Citation[]
├── Timing[]
└── EvaluationScore[]

EvaluationDataset
└── EvaluationCase
    └── ExperimentResult[]
```

Les schémas Prisma exacts ne sont pas définis dans ce document. Ils seront
conçus pendant le programme Engineering avec contraintes, index et migrations
justifiés.

## 9. Métriques utiles

### Retrieval

- source attendue présente dans le top-k ;
- rang réciproque de la première source pertinente ;
- proportion de chunks récupérés jugés pertinents ;
- rappel de la recherche approximative comparé à la recherche exacte ;
- taux de requêtes sans résultat au-dessus du seuil.

### Réponse

- pertinence ;
- correction sur les cas disposant d’une référence ;
- groundedness ;
- couverture des citations ;
- abstention correcte ;
- taux d’affirmations non soutenues.

### Opérationnel

- latence totale, médiane et p95 ;
- durée embedding, retrieval, reranking et génération ;
- tokens d’entrée et de sortie ;
- coût estimé par run ;
- taux d’erreur ;
- taux et durée de réindexation.

Les métriques automatiques ne remplacent pas la revue humaine. Chaque score doit
avoir une définition, une échelle et une limite documentées.

## 10. Architecture logique cible

Le projet commence sous forme de monolithe modulaire :

```text
Web React
   ↓ HTTP
API Hono
   ├── Corpus & Sources
   ├── Ingestion
   ├── Chunking
   ├── Embeddings
   ├── Retrieval
   ├── Generation
   ├── Runs & Telemetry
   └── Evaluations
   ↓
PostgreSQL + pgvector
```

Un worker ne sera créé que si l’ingestion ou les expériences dépassent
raisonnablement le temps d’une requête HTTP. Avant cela, les jobs peuvent être
représentés par des fonctions applicatives et des statuts persistés.

La télémétrie peut être exportée vers OpenTelemetry ou Langfuse plus tard. Le
Run Inspector reste propriétaire au domaine Grounded : il explique le retrieval,
les versions du corpus et les évaluations, sans tenter de remplacer un backend
d’observabilité générique.

## 11. Isolation par rapport à LearnX

Pendant E0 à A6 :

```text
LearnX                         Grounded Inspector
------                         ------------------
dépôt LearnX                   dépôt séparé
base Neon LearnX               base PostgreSQL Grounded
seed / export JSON  ───────▶   import manuel en lecture seule
aucune écriture       ◀─────   aucune mutation LearnX
```

Règles :

- aucune dépendance de package entre les dépôts ;
- aucun accès direct de Grounded à `DATABASE_URL` LearnX ;
- aucun fichier généré dans le repo LearnX ;
- aucun webhook ou synchronisation automatique au MVP ;
- les secrets et environnements sont séparés ;
- l’export importé doit porter une identité ou un checksum calculé par Grounded
  afin d’éviter les réindexations silencieuses.

## 12. Conditions avant intégration à LearnX

Une intégration runtime ne sera proposée que si :

1. le MVP RAG est terminé ;
2. un dataset LearnX représentatif existe ;
3. les métriques de retrieval, groundedness et abstention sont acceptables ;
4. le coût et la latence sont mesurés ;
5. le modèle de permissions empêche le retrieval hors portée ;
6. les risques de prompt injection et fuite de contenu sont traités ;
7. un contrat d’API et des tests de contrat existent ;
8. l’échec de Grounded ne bloque pas le parcours principal LearnX ;
9. un feature flag et un rollback sont prévus ;
10. la décision monolithe LearnX ou service séparé est documentée dans une ADR.

## 13. Définition de terminé du MVP

Le MVP est terminé lorsqu’une autre personne peut, à partir du README :

1. démarrer PostgreSQL et l’application ;
2. créer un corpus ;
3. importer plusieurs fichiers `.md` ou `.txt` ;
4. inspecter les chunks ;
5. poser une question ;
6. obtenir une réponse avec citations ou une abstention explicite ;
7. inspecter les résultats et le contexte du run ;
8. voir latence, tokens et coût ;
9. enregistrer des cas de test ;
10. comparer deux configurations ;
11. relancer les tests en CI ;
12. diagnostiquer une panne documentée.

Le connecteur LearnX est le premier incrément après ce MVP, pas une condition
pour déclarer le laboratoire RAG initial fonctionnel.