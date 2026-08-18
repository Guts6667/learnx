# AI Product Engineer — RAG et évaluation avec SourceLab

## Statut

- Version : 1.0.0
- Statut : `draft`
- Classification : `CONTENT_ONLY`
- Projet fil rouge : SourceLab, produit autonome dans un dépôt et une base séparés de LearnX
- Durée indicative : 49 jours
- Public : Développeur TypeScript/Product Engineer ayant déjà livré une API, un worker, PostgreSQL, Docker, tests et CI, et souhaitant construire des produits IA fiables sans dépendre de Python.

## Promesse produit

Ajouter à SourceLab deux usages bornés : créer des programmes LearnX à partir d’un besoin et de sources, puis proposer des corrections de textes libres fondées sur une grille et un corpus autorisé.

## Résultats attendus

- Construire un corpus versionné et traçable à partir des sources SourceLab.
- Implémenter embeddings, pgvector, recherche hybride, citations et abstention.
- Créer un funnel, un brief et un Program Builder compatible LearnX.
- Construire un moteur de rubrique exécutable où les modèles recherchent ou contestent des preuves et où LearnX calcule les niveaux.
- Évaluer, sécuriser, observer et livrer des fonctions IA avec des gates mesurables.

## Hors périmètre

- Entraîner un modèle fondation.
- Construire un agent généraliste autonome.
- Partager directement la base de SourceLab avec LearnX.
- Valider automatiquement toute réponse à fort enjeu.
- Remplacer la gouvernance éditoriale de LearnX.

## Contenu du dossier

- `CURRICULUM_BLUEPRINT.md` : architecture et progression ;
- `specs/` : une spécification complète par leçon ;
- `stage-assessments/` : une évaluation finale par étape ;
- `SOURCE_MANIFEST.json` : inventaire des ressources et date de contrôle ;
- `../../seed/ai-product-engineer-sourcelab-program.json` : bundle d’import Prisma en brouillon.

## Porte de publication

Le programme ne peut pas être publié tant que les revues `pedagogicalAlignment`, `seedCompatibility`, `linksAndMedia` et les revues techniques humaines ne sont pas approuvées. Les documentations évolutives sont contrôlées au 18 août 2026 et doivent être revérifiées avant publication.
