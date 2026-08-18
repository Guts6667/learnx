# Blueprint pédagogique — Fondations d’ingénierie pour Product Engineers

## Statut

- Version : 0.1.0
- Statut : proposition initiale à valider avant authoring des leçons
- Classification : `CONTENT_ONLY`
- Programme cible : `engineering-foundations-product-engineers`
- Public : Product Engineer ou développeur front-end expérimenté maîtrisant
  TypeScript et la construction d’interfaces, mais souhaitant renforcer backend,
  architecture, infrastructure et exploitation
- Langue principale : français ; ressources officielles en anglais admises
- Rythme cible : six semaines, cinq à six heures par semaine
- Volume indicatif : 34 heures, hors approfondissements facultatifs
- Projet fil rouge : socle applicatif et opérationnel de **Grounded Inspector**
- État d’intégration : blueprint uniquement ; aucun seed et aucune modification
  technique du moteur LearnX

Ce document décrit la carte cible du programme. Il ne remplace ni les futures
`PEDAGOGY_SPEC_XXX.json`, ni les évaluations détaillées, ni le bundle de seed.
Les titres, slugs, durées et séquences deviennent contraignants seulement après
validation de ce blueprint puis intégration explicite.

## 1. Besoin apprenant retenu

L’apprenant sait déjà :

- construire des interfaces en React ou Preact avec TypeScript ;
- transformer un besoin produit en fonctionnalité ;
- lire une base de code et raisonner sur sa maintenabilité ;
- utiliser Git, des API HTTP et une base de données à un niveau opérationnel ;
- déployer une application sur une plateforme managée.

Il ne cherche pas à devenir DevOps, SRE ou administrateur système. Son besoin
est de supprimer les angles morts qui fragilisent un profil de Product Engineer :

- concevoir les frontières d’un service sans sur-ingénierie ;
- construire une API et un modèle de données fiables ;
- comprendre le chemin d’une requête et les composants d’infrastructure ;
- rendre un environnement local reproductible avec Docker ;
- diagnostiquer les pannes fréquentes plutôt que dépendre d’un tiers ;
- livrer avec tests, migrations, observabilité et sécurité proportionnées ;
- discuter avec des ingénieurs backend, plateforme ou sécurité sans usurper leur
  expertise.

## 2. Finalité et résultats d’apprentissage

À l’issue du parcours, l’apprenant doit pouvoir :

1. représenter le contexte, les conteneurs logiques et les composants principaux
   d’une application web ;
2. choisir un monolithe modulaire par défaut et expliciter les signaux qui
   justifieraient une séparation ultérieure ;
3. définir des contrats d’API, valider les entrées et distinguer erreurs métier,
   erreurs techniques et erreurs d’infrastructure ;
4. modéliser des données PostgreSQL avec contraintes, transactions, migrations
   et index adaptés aux requêtes observées ;
5. concevoir une opération rejouable et idempotente, avec états intermédiaires
   et reprise après échec ;
6. expliquer le chemin navigateur, DNS, connexion sécurisée, serveur, processus,
   application et base de données ;
7. distinguer processus, service, port, réseau, stockage persistant, secret,
   configuration et environnement ;
8. construire et diagnostiquer un environnement Docker Compose comprenant une
   API et PostgreSQL ;
9. écrire une image Node.js multi-stage, minimale et exécutée sans privilèges
   inutiles ;
10. mettre en place une CI proportionnée : lint, typecheck, tests, build et
    vérification des migrations ;
11. instrumenter des logs structurés, identifiants de corrélation, métriques de
    base et traces utiles ;
12. appliquer timeouts, retries bornés, healthchecks, readiness et arrêt propre
    aux appels et services appropriés ;
13. protéger secrets, endpoints et imports de fichiers avec des contrôles
    applicatifs de base ;
14. conduire un diagnostic d’incident en séparant symptômes, hypothèses,
    preuves, cause et correction ;
15. défendre une architecture et une procédure de livraison en exposant les
    compromis de coût, complexité, sécurité et fiabilité.

## 3. Positionnement professionnel et limites

Le programme vise l’autonomie d’un ingénieur produit, pas une spécialisation
infrastructure. L’apprenant doit pouvoir construire et exploiter un petit
service, participer à une revue d’architecture et dialoguer efficacement avec
les spécialistes.

Le parcours ne forme pas à :

- administrer Kubernetes, Helm ou un service mesh ;
- concevoir une plateforme interne ou une stratégie multi-cloud ;
- écrire une infrastructure Terraform avancée ;
- exploiter manuellement un cluster PostgreSQL répliqué ;
- assurer une astreinte SRE ou définir des SLO d’organisation à grande échelle ;
- configurer un réseau d’entreprise, un VPN ou un pare-feu complexe ;
- remplacer une revue sécurité spécialisée.

Kubernetes, queues distribuées, Redis et microservices peuvent être cités pour
situer un choix. Ils ne sont ni installés ni requis pour valider le programme.

## 4. Principes de découpage

Le parcours suit l’ordre des dépendances réelles :

```text
frontières du système
→ contrats et données
→ environnement d’exécution
→ reproductibilité avec Docker
→ livraison et observabilité
→ sécurité et diagnostic intégré
```

Chaque étape fait progresser le même dépôt Grounded Inspector. Les leçons ne
sont pas organisées pour couvrir un catalogue de technologies, mais pour
résoudre une difficulté concrète du projet.

Les activités productives utilisent exclusivement les types LearnX existants :

- `writing`, `reflection`, `practice` et `project` deviennent des exercices ;
- `reading`, `watching`, `listening` et `checklist` restent des tâches légères ;
- chaque notion obligatoire possède une mini-évaluation ;
- chaque étape possède une évaluation finale avec seuil et grille explicite ;
- aucune ressource consultée ne constitue une preuve de maîtrise.

## 5. Projet fil rouge — Grounded Inspector, phase Engineering

Grounded Inspector est un petit laboratoire RAG visuel développé dans un dépôt
séparé de LearnX. Le programme Engineering construit uniquement son socle
logiciel avant l’ajout du RAG :

- application web minimale ;
- API TypeScript ;
- PostgreSQL ;
- création de corpus et import de sources `.md` et `.txt` ;
- états d’import, erreurs et réindexation simulée ;
- inspection du contenu normalisé ;
- environnement Docker Compose ;
- tests, CI, logs et endpoints de santé.

Les embeddings, la recherche vectorielle, les appels LLM, les évaluations RAG
et les visualisations de qualité appartiennent au programme
`ai-product-engineer-typescript`.

Le dépôt Grounded n’est ni placé dans le monorepo LearnX, ni connecté à sa base.
Le futur connecteur LearnX lira un fichier de programme exporté ou sélectionné
manuellement, sans écriture dans LearnX.

## 6. Livrable professionnel cumulatif

Le programme aboutit à un dossier d’ingénierie comprenant :

- diagramme de contexte et vue des composants ;
- deux à quatre Architecture Decision Records ;
- contrats d’API et catalogue d’erreurs ;
- modèle de données et justification des contraintes ;
- stratégie de migration et de reprise ;
- Dockerfile et `compose.yaml` documentés ;
- procédure de démarrage, diagnostic et restauration locale ;
- pipeline CI ;
- convention de logs, identifiant de corrélation et endpoint de santé ;
- matrice de timeouts et retries ;
- mini threat model du service et contrôles appliqués ;
- rapport d’incident simulé ;
- README permettant à une autre personne de lancer et vérifier le projet.

Le fonctionnement seul ne suffit pas. Chaque livrable doit expliquer ce qui a
été choisi, ce qui a été écarté et quel signal déclencherait une évolution.

## 7. Architecture cible du programme

### Étape 1 — Concevoir un service proportionné

- Slug cible : `concevoir-service-proportionne`
- Charge indicative : 5 h
- Finalité : passer d’une idée produit à des frontières techniques claires sans
  démarrer par des microservices ou des abstractions prématurées.

Module `architecture-applicative` — Frontières, dépendances et décisions

- Suivre une requête et délimiter le système
  (`suivre-requete-delimiter-systeme`)
- Concevoir un monolithe modulaire
  (`concevoir-monolithe-modulaire`)
- Documenter les compromis avec diagrammes et ADR
  (`documenter-compromis-architecture`)

Évaluation finale : produire l’architecture initiale de Grounded Inspector avec
un diagramme de contexte, une vue des modules, deux ADR et une réponse argumentée
à la question « pourquoi pas des microservices maintenant ? ».

Contribution au projet : structure du dépôt, responsabilités des modules et
interfaces entre application, persistance et adaptateurs externes.

### Étape 2 — Construire une API et une persistance fiables

- Slug cible : `construire-api-persistance-fiables`
- Charge indicative : 7 h
- Finalité : transformer les frontières définies en contrats HTTP et données
  persistées avec des invariants explicites.

Module `api-et-donnees` — Contrats, transactions et reprise

- Concevoir un contrat HTTP et un modèle d’erreur
  (`concevoir-contrat-http-erreurs`)
- Modéliser PostgreSQL, contraintes et migrations
  (`modeliser-postgresql-contraintes-migrations`)
- Gérer concurrence, idempotence et états intermédiaires
  (`gerer-concurrence-idempotence-etats`)

Évaluation finale : implémenter le cycle de vie d’une source Grounded — création,
consultation, import, échec, relance et suppression — avec validation serveur,
contraintes de données, transaction pertinente, migration rejouable et tests
d’intégration.

Contribution au projet : API des corpus et sources, schéma PostgreSQL, catalogue
d’erreurs, premier flux d’import déterministe.

### Étape 3 — Comprendre l’environnement d’exécution

- Slug cible : `comprendre-environnement-execution`
- Charge indicative : 5 h
- Finalité : savoir localiser une panne entre navigateur, réseau, runtime,
  configuration et stockage.

Module `infrastructure-essentielle` — Du navigateur au processus

- Comprendre HTTP, DNS, TLS, ports et proxies
  (`comprendre-http-dns-tls-ports`)
- Distinguer processus, configuration, secrets et stockage
  (`distinguer-processus-configuration-stockage`)
- Comparer serverless, conteneur et serveur durable
  (`comparer-serverless-conteneur-serveur`)

Évaluation finale : analyser six symptômes fournis — résolution de nom, certificat,
port, secret, connexion PostgreSQL et timeout — puis identifier la couche
probable, les preuves à recueillir et la prochaine commande ou observation.

Contribution au projet : carte d’exécution locale et cible, inventaire des
variables, règles de configuration et séparation des données persistantes.

### Étape 4 — Rendre le projet reproductible avec Docker

- Slug cible : `rendre-projet-reproductible-docker`
- Charge indicative : 6 h
- Finalité : construire et diagnostiquer un environnement local cohérent sans
  faire de Docker un but en soi.

Module `docker-compose` — Images, conteneurs et services

- Construire une image Node.js compréhensible
  (`construire-image-nodejs`)
- Orchestrer API, PostgreSQL, réseau et volume
  (`orchestrer-services-compose`)
- Diagnostiquer et durcir les conteneurs
  (`diagnostiquer-durcir-conteneurs`)

Évaluation finale : livrer un `Dockerfile` multi-stage et un `compose.yaml`
permettant de démarrer l’API et PostgreSQL, puis résoudre des pannes injectées :
port occupé, secret invalide, migration absente, volume supprimé et service non
healthy.

Contribution au projet : environnement local reproductible, volume persistant,
healthchecks et procédure de diagnostic.

### Étape 5 — Livrer et observer avec des garde-fous

- Slug cible : `livrer-observer-garde-fous`
- Charge indicative : 6 h
- Finalité : détecter les régressions avant l’utilisateur et rendre une requête
  observable sans construire une plateforme SRE.

Module `fiabilite-et-livraison` — CI, télémétrie et défaillances

- Construire une CI utile et reproductible
  (`construire-ci-utile`)
- Relier logs, métriques, traces et corrélation
  (`relier-logs-metriques-traces`)
- Encadrer timeouts, retries, santé et migrations
  (`encadrer-timeouts-retries-sante`)

Évaluation finale : configurer un workflow CI exécutant lint, typecheck, tests,
build et contrôle des migrations ; instrumenter une requête d’import avec un
identifiant de corrélation ; démontrer un timeout et un retry borné sans masquer
l’échec.

Contribution au projet : pipeline CI, logs structurés, endpoint de santé,
traces minimales et politique de résilience.

### Étape 6 — Sécuriser et opérer une version livrable

- Slug cible : `securiser-operer-version-livrable`
- Charge indicative : 5 h
- Finalité : assembler les compétences précédentes dans une livraison exploitable
  et diagnostiquer un incident sans improvisation.

Module `securite-et-operations` — Contrôles applicatifs et incident

- Appliquer authentification, autorisation et moindre privilège
  (`appliquer-authentification-autorisation`)
- Sécuriser les imports, secrets et dépendances
  (`securiser-imports-secrets-dependances`)
- Conduire une release et un diagnostic d’incident
  (`conduire-release-diagnostic-incident`)

Évaluation finale : livrer la phase Engineering de Grounded Inspector, exécuter
une checklist de release, corriger un incident simulé mêlant fichier invalide,
secret absent et migration non appliquée, puis remettre un rapport séparant
symptômes, chronologie, cause, correction et prévention.

Contribution au projet : version `engineering-ready`, documentation de lancement,
contrôles de sécurité minimaux et dossier d’exploitation.

## 8. Stratégie d’évaluation

### 8.1 Mini-évaluations de notion

Chaque notion obligatoire dispose d’une activité courte parmi les types actuels :

- `quiz` pour les distinctions conceptuelles ;
- `case_question` pour choisir un diagnostic ou un compromis ;
- `short_answer` pour justifier une décision ;
- `practice` pour lire une configuration ou une trace.

Les banques comporteront des distracteurs provenant d’erreurs plausibles :
confondre image et conteneur, considérer un healthcheck comme un test métier,
réessayer une écriture non idempotente ou stocker un secret dans l’image.

### 8.2 Évaluations d’étape

Chaque étape utilise un type existant de `StageAssessment` :

- étape 1 : `case_study` ;
- étape 2 : `practical_exercise` ;
- étape 3 : `simulation` ;
- étape 4 : `practical_exercise` ;
- étape 5 : `practical_exercise` ;
- étape 6 : `project`.

Le seuil cible est 70 %. Une faiblesse bloquante en sécurité, reproductibilité ou
intégrité des données impose une remédiation même si le score agrégé dépasse le
seuil.

### 8.3 Preuves de maîtrise

Les preuves attendues sont des fichiers versionnés, commandes reproductibles,
tests, captures de traces ou explications structurées. Le simple fait que
l’application « fonctionne sur la machine de l’apprenant » n’est pas suffisant.

## 9. Prérequis et diagnostic initial

Prérequis nécessaires :

- TypeScript courant ;
- Git et terminal ;
- compréhension d’une requête API simple ;
- bases SQL : table, ligne, clé primaire et requête `SELECT` ;
- capacité à exécuter un projet Node.js localement.

Un diagnostic initial non certifiant vérifiera ces prérequis. Les lacunes
ponctuelles renverront vers des ressources de remédiation ; elles ne justifient
pas l’ajout de leçons JavaScript ou React généralistes au programme.

## 10. Sources de cadrage prévues

Les leçons privilégieront des sources primaires et officielles :

- documentation MDN pour HTTP, sécurité du Web et échanges client-serveur ;
- documentation PostgreSQL pour transactions, contraintes, index et analyse de
  requêtes ;
- documentation Docker pour images, Dockerfile, Compose, volumes, réseaux et
  builds multi-stage ;
- documentation GitHub Actions pour intégration et déploiement continus ;
- documentation OpenTelemetry pour traces, métriques, logs et conventions
  sémantiques ;
- OWASP pour les risques applicatifs et les contrôles de fichiers, API et secrets ;
- documentation Node.js pour runtime, processus, variables d’environnement et
  arrêt propre.

Les versions, dates de consultation, localisateurs et statuts d’accès seront
renseignés dans chaque sidecar éditorial. Une page officielle évolutive sera
revérifiée avant publication.

## 11. Compatibilité avec le modèle LearnX actuel

Le programme n’exige aucun nouveau champ, type ou état. Il sera représenté par :

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

Règles d’authoring bloquantes :

- toute leçon complète possède résumé, objectifs, prérequis, durée et séquence ;
- chaque clé est stable et unique dans sa leçon ;
- les positions sont cohérentes et ne servent jamais d’identifiant ;
- toute notion obligatoire a une ressource de la leçon et une évaluation ;
- toute activité productive n’est représentée qu’une fois comme exercice ;
- chaque élément canonique apparaît exactement une fois dans `lesson.sequence` ;
- chaque étape possède son évaluation finale ;
- les blocs de connaissance sont reliés à des références vérifiées ;
- le programme reste `draft` tant que les revues éditoriales et techniques ne
  sont pas terminées.

## 12. Plan d’authoring

1. Valider ce blueprint et le périmètre Grounded phase Engineering.
2. Réserver les identifiants globaux des spécifications et évaluations.
3. Authorer l’étape 1 comme lot pilote complet : trois leçons, banques et
   évaluation finale.
4. Valider la charge réelle et la qualité des activités sur Grounded.
5. Authorer les étapes 2 à 6 par lots autonomes.
6. Générer le bundle de seed en statut `draft`.
7. Ajouter le lecteur du seed et les validations ciblées dans une modification
   technique distincte.
8. Exécuter lint, typecheck, tests, validation JSON et import sur une base isolée.
9. Décider explicitement de la publication.

Aucune étape d’authoring ne doit modifier le dépôt Grounded ni l’architecture de
LearnX. Les productions de l’apprenant sont réalisées dans son dépôt externe.