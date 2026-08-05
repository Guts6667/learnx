# Sources pédagogiques — Fondamentaux de la psychologie

Ce dossier contient les artefacts éditoriaux versionnés du programme.

## Rôles des fichiers

- `CURRICULUM_BLUEPRINT.md` définit la progression cible du programme.
- `specs/` contient une spécification et son sidecar éditorial par leçon
  disponible. Le sidecar conserve les références, revues et contrôles qui ne
  sont pas persistés dans PostgreSQL.
- `stage-assessments/` contient les évaluations finales des étapes.
- `assessment-banks/` contient les banques éditoriales séparées.
- `../../seed/sample-program.json` est le bundle consolidé accepté par
  `prisma/seed.ts` et importé en base.

## Source de vérité actuelle

Le seed reste l'autorité technique de l'import. Les fichiers éditoriaux restent
indispensables pour l'audit et la maintenance scientifique. Ils ne doivent pas
être supprimés au motif que leur projection existe en base.

La consolidation n'est pas encore entièrement générée : la première leçon du
seed ne possède pas encore de `PEDAGOGY_SPEC_001.json`. Avant d'automatiser
`specs -> seed`, créer et valider cette source manquante, puis ajouter un
générateur déterministe et un contrôle de dérive en CI.
