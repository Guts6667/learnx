# AI Product Engineer — RAG et évaluation pour SourceLab

## Statut

- Version : 1.0.0
- Statut : brouillon privé
- Classification pédagogique : `CONTENT_ONLY`
- Date de création : 18 août 2026
- Projet fil rouge : SourceLab, développé dans un dépôt et une base séparés de LearnX
- Publication : interdite tant que les revues éditoriale, technique, pédagogique et les contrôles de liens ne sont pas terminés

## Finalité

Transformer SourceLab V1 en laboratoire d’AI Product Engineering centré sur deux usages : générer des programmes LearnX sourcés à partir d’un besoin et de matériaux, puis proposer une correction structurée de réponses libres à partir d’une rubrique et de contenus autorisés. Le RAG reste une infrastructure au service de ces usages.

## Prérequis

Avoir terminé le programme Ingénieur logiciel en production — Construire SourceLab ou démontrer un niveau équivalent sur API Node.js, PostgreSQL, traitements asynchrones, Docker, tests, CI et observabilité.

## Résultat produit

À la fin, SourceLab contient un Program Builder et un Assessment Reviewer en démonstration. Ils reposent sur ingestion versionnée, chunking évalué, embeddings, recherche hybride, sorties structurées, datasets, sécurité, observabilité et gates de promotion. Aucun brouillon n’est publié et aucune note définitive n’est écrite automatiquement dans LearnX.

## Frontière avec LearnX

SourceLab génère, analyse et recommande ; LearnX importe, publie, conserve progression et décide. Les bases restent séparées. Le premier contrat d’intégration est un export LearnX-compatible, puis éventuellement une API limitée.

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
