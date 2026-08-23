# AGENTS.md

## Mission

Construire LearnX comme une plateforme générique et modulaire de parcours d’apprentissage.

## Routage documentaire

- Lire `docs/INDEX.md` avant de charger une documentation supplémentaire.
- Ne pas lire les archives V1/V2 pour une tâche courante, sauf demande
  explicite ou recherche historique ciblée.
- Pour un ticket V3, lire uniquement `BACKLOG_V3.md`, l'ADR ou la spécification
  citée par le ticket, puis les fichiers de code concernés.
- Pour un ticket V3.5, lire uniquement `BACKLOG_V3_5.md`, le matériel de design
  ou l'ADR cité, puis les fichiers concernés. V3.5 ne commence qu'après clôture
  officielle de V3.
- Pour un ticket V4, lire uniquement `BACKLOG_V4.md`, l'ADR ou la spécification
  citée, puis les fichiers concernés. V4 consomme la baseline V3.5 clôturée.
- Pour une modification pédagogique, appliquer la liste dédiée ci-dessous ; ne
  pas charger toutes les spécifications pédagogiques du programme.

## Commandes attendues

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

## Conventions

- TypeScript strict.
- Pas de `any` sans justification documentée.
- Fonctions courtes.
- Noms explicites.
- Composants Preact fonctionnels.
- Logique métier hors des composants.
- API responses typées.
- Erreurs normalisées.
- Imports absolus depuis `@/`.
- Aucun secret commité.
- Aucune mutation silencieuse.
- Accessibilité par défaut.

## Git

Un ticket correspond idéalement à un commit ou une pull request.

Format conseillé :

```text
feat(auth): implement secure session login
test(progress): cover weighted lesson calculation
fix(pwa): prevent stale mutation cache
```

## Definition of Done

Un ticket est terminé lorsque :

- les critères sont couverts ;
- lint passe ;
- typecheck passe ;
- tests passent ;
- build passe ;
- la documentation utile est actualisée ;
- aucune erreur connue n’est masquée.


## Contraintes de domaine

- Ne jamais introduire `AcademicYear` ou `Semester`.
- Utiliser exclusivement `Program`, `Stage`, `Module`, `Lesson`.
- Ne pas coder en dur la psychologie dans les composants ou modèles.
- Le programme de psychologie n’est qu’un seed d’exemple.


## Temps et progression

- Les dates sont stockées en UTC.
- La logique d’avance/retard doit être pure et testée.
- Les durées indicatives ne doivent pas modifier la hiérarchie Program > Stage > Module > Lesson.
- Ne pas confondre durée indicative et calendrier académique.


## Validation pédagogique

- Avant de créer ou modifier une `PEDAGOGY_SPEC_XXX`, lire intégralement
  `EDITORIAL_GUIDELINES.md`, `PEDAGOGY_AUTHORING_GUIDE.md`,
  `content/fondamentaux-psychologie/CURRICULUM_BLUEPRINT.md` et
  `PEDAGOGY_CHANGE_POLICY.md`.
- Toute `PEDAGOGY_SPEC_XXX` doit respecter ces quatre documents ; les contrôles
  de publication applicables sont bloquants.
- Distinguer systématiquement `editorial.references` (sources utilisées pour
  établir le contenu) et `lesson.resources` (ressources recommandées à
  l’apprenant).
- Tout bloc de connaissance doit être traçable vers au moins une référence
  vérifiée et tout indice de confiance doit être justifié.
- Le payload `lesson` d’une `PEDAGOGY_SPEC_XXX.json` doit rester strictement
  compatible avec le schéma Zod de `prisma/seed.ts` ; les métadonnées de preuve
  restent dans le sidecar `editorial` non importé.
- Aucun nombre fixe d’étapes, modules, leçons ou notions ne doit être imposé au
  détriment de la cohérence pédagogique.
- Toute notion obligatoire doit avoir une évaluation.
- Toute étape publiée doit avoir une évaluation finale.
- Une ressource ouverte ne valide pas une notion.
- Les calculs de maîtrise et de validation sont côté serveur.
- Les tentatives sont conservées.
- Les règles de publication doivent bloquer les contenus pédagogiquement incomplets.
- Une évolution éditoriale ne doit pas modifier implicitement l’architecture
  technique, le schéma de données ou `BACKLOG_V3.md`.
