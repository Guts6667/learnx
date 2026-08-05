# Architecture technique

## 1. Stack

### Frontend

- Preact
- Vite
- TypeScript strict
- Tailwind CSS
- `preact-router`
- TanStack Query pour l’état serveur
- React Hook Form via `preact/compat` uniquement si nécessaire
- Zod

### Backend

- Vercel Functions dans `/api`
- TypeScript
- Hono pour router proprement les endpoints
- Prisma ORM
- PostgreSQL
- Prisma Client
- Neon comme hébergement PostgreSQL de référence

### Authentification

MVP :

- email ;
- mot de passe ;
- session opaque persistée dans PostgreSQL ;
- cookie `HttpOnly`, `Secure`, `SameSite=Lax` ;
- mot de passe hashé avec `argon2id`.

L’authentification est implémentée côté serveur. Aucun token de session n’est stocké dans `localStorage`.

### PWA

- `vite-plugin-pwa`
- manifest généré ;
- service worker ;
- mode `standalone` ;
- cache de l’app shell ;
- cache des contenus publics/pédagogiques déjà consultés ;
- aucune mutation utilisateur mise en cache comme succès avant confirmation serveur.

### Tests

- Vitest
- Preact Testing Library
- Playwright
- tests unitaires de la logique métier
- tests d’intégration des API
- parcours E2E critique

## 2. Structure cible

```text
/
├── api/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   ├── register.ts
│   │   └── session.ts
│   ├── today.ts
│   ├── programs/
│   ├── lessons/
│   ├── tasks/
│   ├── quizzes/
│   ├── notes/
│   ├── reviews/
│   └── _lib/
│       ├── auth.ts
│       ├── db.ts
│       ├── errors.ts
│       ├── response.ts
│       └── validation.ts
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── learning/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── today/
│   │   ├── curriculum/
│   │   ├── lessons/
│   │   ├── quizzes/
│   │   ├── notes/
│   │   └── reviews/
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── query-client.ts
│   │   ├── progress.ts
│   │   └── recommendation.ts
│   ├── pages/
│   ├── styles/
│   ├── types/
│   └── main.tsx
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   └── server/
│       └── prisma.ts
├── seed/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
├── AGENTS.md
├── vite.config.ts
├── vercel.json
├── prisma.config.ts
└── package.json
```

## 3. Routage frontend

- `/login`
- `/today`
- `/program`
- `/semester/:stageSlug`
- `/program/:programSlug/module/:moduleSlug`
- `/program/:programSlug/lesson/:lessonSlug`
- `/program/:programSlug/lesson/:lessonSlug/quiz`
- `/reviews`
- `/notes`
- `/notes/:noteId`
- `/profile`
- `/admin`

Les routes privées redirigent vers `/login` sans session active.

## 4. API

Préfixe : `/api`

### Auth

- `POST /api/auth/register` — disponible hors production uniquement
- `POST /api/access-requests` — demande publique sans mot de passe, réponse non
  énumérante et rate limit partagé
- `POST /api/access-requests/verify-email` — vérification one-shot de l’adresse
- `POST /api/access-invitations/activate` — activation one-shot, création du
  compte et ouverture de session atomiques
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

Une session n’est créée et acceptée que si `User.accountStatus` vaut `ACTIVE`.
La suspension et la révocation de toutes les sessions partagent une transaction
serveur afin qu’aucune session résiduelle ne survive au commit.

### Administration des comptes

- `GET /api/admin/accounts` — liste paginée et filtrable
- `POST /api/admin/accounts/:userId/suspend` — suspension et révocation globale
- `POST /api/admin/accounts/:userId/reactivate` — réactivation sans restauration
  de session

Ces endpoints exigent la capacité `account.suspend`, utilisent une précondition
de statut/version temporelle et écrivent un événement d’audit sans donnée
personnelle.

### Parcours

- `GET /api/programs`
- `GET /api/programs/:programSlug/stages/:stageSlug`
- `GET /api/modules/:slug`
- `GET /api/lessons/:slug`

Les contenus publiés possèdent une version immuable (`ProgramVersion`) avec
snapshot canonique et checksum. La hiérarchie relationnelle reste la copie de
travail ; la version suivie par un apprenant sera reliée par les enrollments du
ticket V3-011.

### Progression et planification

- `POST /api/programs/:id/start`
- `PATCH /api/programs/:id/schedule`
- `POST /api/stages/:id/start`
- `PATCH /api/stages/:id/schedule`
- `POST /api/lessons/:id/start`
- `POST /api/lessons/:id/complete`
- `PATCH /api/tasks/:id`
- `PATCH /api/resources/:id/progress`

### Notions et évaluations

- `GET /api/concepts/:id`
- `GET /api/concepts/:id/progress`
- `POST /api/concepts/:id/validate`
- `GET /api/quizzes/:id`
- `POST /api/quizzes/:id/attempts`
- `GET /api/quizzes/:id/attempts`
- `GET /api/stages/:id/assessment`
- `POST /api/stage-assessments/:id/submissions`
- `PATCH /api/stage-assessment-submissions/:id`
- `POST /api/stage-assessment-submissions/:id/submit`

### Notes

- `GET /api/notes`
- `POST /api/notes`
- `PATCH /api/notes/:id`
- `DELETE /api/notes/:id`

### Révisions

- `GET /api/reviews`
- `PATCH /api/reviews/:id`

### Aujourd’hui

- `GET /api/today`

## 5. Sécurité

- accès PostgreSQL uniquement côté serveur ;
- cookies de session sécurisés ;
- protection brute-force partagée dans PostgreSQL entre les instances
  serverless, avec clé client/e-mail hachée ;
- demandes d'accès protégées par des compteurs partagés IP/e-mail hachés,
  idempotentes sur l'e-mail normalisé et désactivables par kill switch ;
- inscription directe désactivée en production jusqu’au cycle d’accès V3 ;
- validation Zod de toutes les entrées ;
- capacités serveur centralisées par rôle avec refus par défaut ;
- le rôle `CREATOR` conserve uniquement les capacités d'apprentissage et
  n'ouvre jamais `/admin` ;
- vérification systématique de propriété par `userId` ;
- mutations administratives sensibles auditées dans la même transaction, avec
  clé d'idempotence et métadonnées techniques sans secret ni donnée personnelle ;
- Markdown rendu après sanitisation ;
- erreurs serveur sans fuite de stack ;
- réponses correctes des quiz non envoyées avant soumission ;
- variables secrètes uniquement dans Vercel ;
- aucune donnée sensible dans le service worker.

## 6. PWA et hors-ligne

MVP hors-ligne :

- l’app shell se charge ;
- les pages pédagogiques déjà ouvertes peuvent être relues ;
- une bannière indique l’absence de connexion ;
- les actions modifiant la progression sont désactivées ou mises en attente explicitement ;
- aucune progression ne doit apparaître comme synchronisée tant que le serveur n’a pas confirmé.

## 7. Décisions importantes

- Preact est utilisé directement, pas via Next.js.
- Vite produit le frontend.
- Les Vercel Functions assurent la couche API.
- PostgreSQL est la source de vérité.
- Prisma assure le schéma, les migrations et les requêtes typées.
- Le frontend ne contient aucune logique de sécurité faisant foi.


## 8. Calcul temporel

Créer des fonctions métier pures dans `src/lib/timeline.ts` :

- `calculateTargetEndDate`
- `calculateExpectedProgress`
- `calculateProgressDelta`
- `calculateTemporalStatus`

Ces fonctions doivent être utilisées côté serveur et couvertes par des tests unitaires.

La progression attendue est linéaire dans le MVP.

Les dates sont stockées en UTC et affichées dans le fuseau local de l’utilisateur.


## 9. Moteur de validation pédagogique

Créer des fonctions métier pures :

- `calculateConceptStatus`
- `isConceptValidated`
- `calculateStageValidation`
- `isStageValidated`
- `getMissingStageRequirements`

Contraintes :

- une ressource consultée ne valide jamais seule une notion ;
- chaque notion obligatoire possède au moins une évaluation ;
- chaque étape publiée possède au moins une évaluation finale ;
- la publication doit échouer si ces règles ne sont pas respectées ;
- les scores et validations sont calculés côté serveur.
