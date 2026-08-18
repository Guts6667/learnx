# Blueprint pédagogique — Ingénieur logiciel en production — Construire SourceLab

## Statut

- Version : 1.0.0
- Statut : brouillon privé
- Classification : `CONTENT_ONLY` pour le contenu ; l’enregistrement du seed utilise le mécanisme existant sans migration
- Programme cible : `ingenieur-logiciel-production-sourcelab`
- Public : Développeur front-end TypeScript expérimenté, à l’aise avec le produit et les API, mais souhaitant consolider backend, Docker et production.
- Rythme cible : Six semaines, six à huit heures par semaine, environ 45 à 55 heures
- Projet fil rouge : SourceLab, dépôt autonome séparé de LearnX
- Date de création : 18 août 2026

## 1. Finalité

Ce parcours comble le gap entre savoir construire une interface et savoir assumer une fonctionnalité jusqu’à son exécution réelle. Il développe le niveau d’infrastructure nécessaire à un bon ingénieur produit : comprendre, intégrer, livrer, observer et réparer son service, sans former à l’exploitation d’une plateforme d’entreprise.

## 2. Résultats d’apprentissage

1. suivre une requête du navigateur au processus et localiser une panne par preuves ;
2. construire des images Node.js reproductibles et une stack Compose prête et persistante ;
3. concevoir une API et un worker asynchrones, idempotents et résistants à la concurrence ;
4. modéliser des sources versionnées et déployer des migrations compatibles ;
5. tester une verticale sur des dépendances réelles et promouvoir un artefact identifié ;
6. instrumenter le parcours d’import, répondre à un incident et vérifier la restauration ;
7. expliquer les décisions et limites sans se présenter comme DevOps ou SRE.

## 3. Résultat produit et versions

Le parcours livre SourceLab V1 — Source Workspace :
1. créer un projet ;
2. importer un fichier ou une URL ;
3. créer un job visible ;
4. traiter la source dans un worker ;
5. conserver version, provenance et statut ;
6. consulter les erreurs ;
7. exporter un Source Pack minimal.

Chaque étape rend cette boucle plus fiable : runtime, conteneurs, concurrence, données, livraison puis exploitation.

## 4. Frontière d’architecture

```text
Dépôt LearnX                         Dépôt SourceLab
programme et progression             code, base, fichiers et expériences
        │                                      │
        └──── export/API versionné ────────────┘
```

SourceLab ne se connecte jamais directement à la base LearnX. LearnX reste la source de vérité des programmes publiés, utilisateurs, progressions, soumissions et décisions finales. Les livrables du parcours sont réalisés dans SourceLab ; LearnX ne reçoit que des artefacts explicitement validés.

## 5. Architecture du parcours

### Étape 1 — Comprendre l’exécution et le réseau

- Slug : `comprendre-runtime-et-reseau`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Diagnostiquer une verticale SourceLab
- Leçons :
  - Suivre une requête du navigateur au processus Node.js (`suivre-requete-processus-http`)
  - Diagnostiquer le runtime, la configuration et l’arrêt (`diagnostiquer-runtime-configuration-arret`)

**Livrable d’étape :** Rapport de diagnostic de 2 à 3 pages, commandes et sorties utiles, patch TypeScript et démonstration de l’arrêt propre.

### Étape 2 — Containeriser SourceLab

- Slug : `containeriser-sourcelab`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Livrer SourceLab localement avec Docker
- Leçons :
  - Construire des images Node.js reproductibles (`construire-images-node-reproductibles`)
  - Orchestrer API, worker et PostgreSQL avec Compose (`orchestrer-api-worker-postgres-compose`)

**Livrable d’étape :** Dépôt exécutable par `docker compose up --build`, README de démarrage, rapport d’inspection et vidéo ou journal de démonstration.

### Étape 3 — Intégrer API, worker et données

- Slug : `integrer-api-worker-donnees`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Rendre l’import asynchrone fiable
- Leçons :
  - Concevoir l’API d’import et le cycle d’un job (`concevoir-api-import-cycle-job`)
  - Garantir idempotence, retries et concurrence (`garantir-idempotence-retries-concurrence`)

**Livrable d’étape :** API et worker fonctionnels, schéma d’états, tests d’intégration, journal des exécutions et note d’architecture.

### Étape 4 — Faire évoluer les données sans casse

- Slug : `faire-evoluer-donnees`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Faire évoluer le modèle SourceLab
- Leçons :
  - Modéliser sources, versions et provenance (`modeliser-sources-versions-provenance`)
  - Déployer une migration compatible et vérifiable (`deployer-migration-compatible-verifiable`)

**Livrable d’étape :** Migrations Prisma/SQL, script de backfill, rapport d’intégrité et performance, plan de déploiement et de retour.

### Étape 5 — Tester et livrer une verticale réelle

- Slug : `tester-et-livrer`
- Durée indicative : 7 jours
- Évaluation : Évaluation — Construire la chaîne de preuve SourceLab
- Leçons :
  - Tester SourceLab avec ses dépendances réelles (`tester-sourcelab-dependances-reelles`)
  - Construire une CI et promouvoir un artefact (`construire-ci-promouvoir-artefact`)

**Livrable d’étape :** Workflow GitHub Actions, tests et fixtures, artefacts, preuve de staging et note de promotion.

### Étape 6 — Opérer et diagnostiquer SourceLab

- Slug : `operer-et-diagnostiquer`
- Durée indicative : 7 jours
- Évaluation : Évaluation finale — Restaurer SourceLab après incident
- Leçons :
  - Instrumenter le parcours d’un import (`instrumenter-parcours-import`)
  - Traiter un incident et restaurer le service (`traiter-incident-restaurer-service`)

**Livrable d’étape :** Simulation chronométrée de 60 minutes, journal d’incident, tableau de bord, postmortem et runbook d’exploitation.

## 6. Progression pédagogique

Chaque étape suit la boucle : contenu sourcé → mise en situation SourceLab → production dans le dépôt externe → mini-évaluation de notion → quiz de transfert → évaluation finale d’étape.

Les deux leçons d’une étape construisent un même incrément. L’évaluation finale ne demande pas une production sans préparation : elle assemble, met sous contrainte et vérifie les livrables réalisés dans les leçons.

## 7. Hors périmètre

- administration Kubernetes, Helm, service mesh ou cluster de production ;
- Terraform, Ansible et réseau cloud avancés ;
- multi-région active-active et astreinte SRE complète ;
- construction de la fonctionnalité IA : elle appartient au deuxième programme ;
- modification du dépôt LearnX pour héberger SourceLab.

## 8. Stratégie de sources

Les leçons s’appuient d’abord sur les documentations officielles Node.js, Docker, PostgreSQL, Prisma, Vitest, Playwright, GitHub Actions et OpenTelemetry, complétées par le Site Reliability Engineering de Google pour le monitoring et la gestion d’incident.

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
