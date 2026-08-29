# Prompt maître Codex

Tu travailles sur **LearnX**, une PWA modulaire de gestion de parcours
d’apprentissage. La V4.1 est publiée : React 19 est l'unique runtime UI et les
monolithes API, Prisma, i18n et CSS ont été décomposés, à comportement produit
constant.

Avant toute modification, lis uniquement :

- `AGENTS.md`
- `docs/HANDOFF.md` puis `docs/INDEX.md`
- le ticket actif dans le backlog courant ;
- les documents que `docs/INDEX.md` associe explicitement à ce type de tâche.

Ne charge jamais tous les documents, toutes les `PEDAGOGY_SPEC` ou les archives
par défaut. Recherche d'abord les fichiers et passages pertinents.

Un backlog clôturé (`BACKLOG_V3.md`, `BACKLOG_V3_5.md`, `BACKLOG_V4.md`,
`V4_1_BACKLOG.md`) est une preuve historique, jamais une instruction active.

## Stack obligatoire

- React 19
- React Router
- TanStack Query
- primitives shadcn style « Maia », liées aux tokens LearnX
- Vite
- TypeScript strict
- Tailwind CSS
- PostgreSQL
- Prisma ORM, schéma multi-file sous `prisma/models/`
- Vercel Functions
- Vercel
- vite-plugin-pwa
- Vitest
- React Testing Library
- Playwright

## Règles absolues

- React 19 est l'unique runtime UI. Preact a été retiré en V4.1 et le gate
  `quality:imports` échoue si un import Preact réapparaît.
- N’utilise pas Next.js.
- N’utilise pas Supabase.
- PostgreSQL est la source de vérité.
- Le frontend ne se connecte jamais directement à PostgreSQL.
- Les données privées passent par `/api`.
- Ne stocke jamais la session dans `localStorage`.
- Ne traite qu’un ticket à la fois.
- N’ajoute aucune fonctionnalité hors périmètre.
- N’expose jamais les bonnes réponses d’un quiz avant soumission.
- Toute entrée serveur est validée avec Zod.
- Toute logique métier importante est testée.
- Toute nouvelle `PEDAGOGY_SPEC_XXX` respecte intégralement
  `EDITORIAL_GUIDELINES.md`, `PEDAGOGY_AUTHORING_GUIDE.md`,
  `content/fondamentaux-psychologie/CURRICULUM_BLUEPRINT.md` et
  `PEDAGOGY_CHANGE_POLICY.md`.
- Une spécification pédagogique ne peut être déclarée complète ou publiable si
  les critères de publication applicables ne sont pas satisfaits.
- Le champ `lesson` d’une `PEDAGOGY_SPEC_XXX.json` doit être directement
  compatible avec `prisma/seed.ts`. Le sidecar `editorial` n’est pas importé.
- La gouvernance éditoriale ne modifie pas implicitement l’architecture
  technique, le modèle de données ou le backlog : toute évolution de ce type
  nécessite un ticket séparé explicitement demandé.

## Méthode

Pour le ticket demandé :

1. inspecte le dépôt ;
2. reformule le périmètre ;
3. propose un plan court ;
4. implémente ;
5. ajoute les tests ;
6. lance :
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
7. corrige les erreurs ;
8. livre un rapport.

## Rapport obligatoire

- Résumé
- Fichiers modifiés
- Migrations
- Tests ajoutés
- Commandes exécutées
- Résultats
- Décisions techniques
- Limites ou suite nécessaire

## Première instruction

Identifier le ticket explicitement demandé dans le backlog courant et ne traiter
que celui-ci. Ne jamais reprendre un ticket d'un backlog clôturé comme
instruction active.


## Modèle pédagogique obligatoire

LearnX ne doit contenir aucune structure `AcademicYear` ou `Semester`.

La hiérarchie est strictement :

```text
Program -> Stage -> Module -> Lesson
```

Les étapes sont des blocs logiques libres, sans durée calendaire obligatoire.

L’application doit accepter plusieurs programmes indépendants.


## Planification

Les programmes et étapes restent modulaires, mais peuvent avoir une durée indicative.

L’implémentation doit permettre :

- date de début réelle ;
- date de fin cible ;
- progression attendue ;
- comparaison avec la progression réelle ;
- statut d’avance ou de retard.

Ne pas réintroduire d’années ou de semestres pour cela.


## Évaluations pédagogiques obligatoires

Le modèle doit inclure :

- des notions explicites ;
- au moins une activité courte de validation par notion obligatoire ;
- au moins une évaluation finale par étape publiée.

Une ressource consultée ne prouve jamais la maîtrise.

Une étape ne peut être validée que lorsque toutes ses notions obligatoires et son évaluation finale sont validées.
