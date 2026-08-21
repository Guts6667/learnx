# AI Product Engineer — RAG et évaluation avec SourceLab

## Statut

- Version : 1.0.1
- Statut runtime : `active`, publication publique autorisée le 21 août 2026
- Classification : `CONTENT_ONLY`
- Projet fil rouge : SourceLab, produit autonome dans un dépôt et une base séparés de LearnX
- Durée indicative : 49 jours
- Public : développeur TypeScript/Product Engineer ayant terminé
  `checkpoint-07-continuous-delivery` du programme SourceLab 2.0, ou disposant
  d’un service local équivalent produisant une `SourceVersion READY` traçable,
  et souhaitant construire des produits IA fiables sans dépendre de Python.

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
- `../../seed/ai-product-engineer-sourcelab-program.json` : bundle d’import
  Prisma actif.

## Publication et traçabilité éditoriale

Le programme est actif et public dans LearnX depuis le 21 août 2026, après
validation explicite du propriétaire et répétition isolée de sa publication.
Les statuts de revue conservés dans les sidecars restent des traces éditoriales
historiques : ils ne sont pas requalifiés rétroactivement et ne simulent aucun
reviewer. Les documentations évolutives ont été contrôlées au 18 août 2026 et
doivent être revérifiées avant toute révision substantielle du parcours.
