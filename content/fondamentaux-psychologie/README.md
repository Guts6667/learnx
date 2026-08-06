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
indispensables pour l'audit, la justification des séquences et la maintenance
scientifique. Ils ne doivent pas être supprimés au motif que leur projection
existe en base.

Les 70 leçons du seed possèdent désormais une source éditoriale numérotée de
`PEDAGOGY_SPEC_001.json` à `PEDAGOGY_SPEC_070.json`. Le contrôle automatisé
vérifie leurs identités, leurs clés, leurs sources et l'égalité exacte de leur
séquence avec le seed. Le seed demeure le bundle importable ; toute modification
éditoriale doit être portée dans la spec correspondante et réconciliée avec lui
dans le même changement.
