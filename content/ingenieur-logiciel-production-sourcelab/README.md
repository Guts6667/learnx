# Ingénieur logiciel en production — Construire SourceLab

## Statut

- Version : 1.0.0
- Statut : brouillon privé
- Classification pédagogique : `CONTENT_ONLY`
- Date de création : 18 août 2026
- Projet fil rouge : SourceLab, développé dans un dépôt et une base séparés de LearnX
- Publication : interdite tant que les revues éditoriale, technique, pédagogique et les contrôles de liens ne sont pas terminés

## Finalité

Renforcer les compétences qui permettent à un développeur produit de posséder une verticale complète : comprendre son runtime, containeriser, intégrer API, worker et base, faire évoluer les données, tester réellement, livrer puis diagnostiquer. Le programme ne vise ni l’administration d’une plateforme, ni Kubernetes avancé, ni une reconversion DevOps.

## Prérequis

Maîtriser TypeScript, savoir construire une interface et appeler une API. Une première expérience de Node.js ou PostgreSQL aide, mais les mécanismes nécessaires sont reconstruits pendant le parcours.

## Résultat produit

À la fin, SourceLab V1 permet de créer un projet, importer une source, suivre son traitement asynchrone, conserver versions et provenance, inspecter les statuts puis exporter un Source Pack. Le produit local possède API, worker, PostgreSQL, Docker Compose, tests d’intégration, CI, staging, observabilité et runbook.

## Frontière avec LearnX

SourceLab résout hors de LearnX la préparation et le traitement des sources. Il ne lit pas la base LearnX et ne partage aucun secret. Le futur lien se fera par export JSON ou API explicitement authentifiée.

LearnX sert à suivre le parcours et à importer ultérieurement les artefacts validés. Le programme n’ajoute aucune fonctionnalité IA, table, endpoint ou dépendance au dépôt LearnX. Les exercices sont réalisés dans le dépôt autonome SourceLab.

## Contenu du dossier

- `CURRICULUM_BLUEPRINT.md` : progression et livrables ;
- `specs/` : spécifications détaillées de chaque leçon ;
- `stage-assessments/` : évaluations finales des étapes ;
- bundle Prisma correspondant dans `seed/`.

## Conditions avant publication

- vérifier chaque URL et sa section cible ;
- faire relire les choix techniques et les exercices ;
- exécuter les contrôles de compatibilité du seed ;
- valider la charge réelle avec l’apprenant ;
- confirmer que le dépôt SourceLab est disponible sans modifier le repo LearnX ;
- conserver le programme en brouillon si une ressource ou une évaluation n’est pas vérifiée.
