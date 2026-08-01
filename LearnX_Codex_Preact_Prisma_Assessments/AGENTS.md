# AGENTS.md

## Mission

Construire LearnX comme une plateforme générique et modulaire de parcours d’apprentissage.

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

- Toute notion obligatoire doit avoir une évaluation.
- Toute étape publiée doit avoir une évaluation finale.
- Une ressource ouverte ne valide pas une notion.
- Les calculs de maîtrise et de validation sont côté serveur.
- Les tentatives sont conservées.
- Les règles de publication doivent bloquer les contenus pédagogiquement incomplets.
