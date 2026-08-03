# LearnX — Kit de transmission Codex

LearnX est une PWA privée, mobile-first et modulaire permettant de suivre des parcours d’apprentissage autonomes.

L’application n’est pas limitée à la psychologie. Chaque sujet est organisé sous forme de programme, lui-même découpé en étapes, modules et leçons.

Le backlog V1 livré est conservé dans `BACKLOG_CODEX.md`. Les priorités issues
de l’audit sécurité, intégrité, UX et production sont suivies dans
`BACKLOG_V2.md`, centré sur la stabilité puis le polish UI/UX. Le parcours unifié
centré sur la leçon est défini dans `LEARNING_FLOW_SPEC.md`. Les capacités métier
reportées sont listées dans `V3_CANDIDATES.md` ; la validation scientifique
optionnelle reste une vision future dans `SCIENTIFIC_REVIEW_SPEC.md`.

## Stack imposée

- Preact
- Vite
- TypeScript strict
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- Vercel
- Vercel Functions
- PWA avec `vite-plugin-pwa`
- Vitest
- Preact Testing Library
- Playwright

## Architecture pédagogique

```text
Programme
└── Étape
    └── Module
        └── Leçon
            ├── Blocs de contenu
            ├── Ressources
            ├── Tâches
            ├── Quiz
            ├── Exercices
            └── Révisions
```

La structure reste indépendante des années et semestres, mais chaque programme et chaque étape peut avoir une durée indicative. Lorsqu’un utilisateur démarre un programme ou une étape, LearnX calcule une date de fin cible et compare la progression réelle à la progression attendue.

## Démarrage avec Codex

1. Créer un repository vide.
2. Copier le contenu de ce kit à la racine.
3. Ouvrir le repository dans Codex.
4. Donner à Codex le contenu de `CODEX_MASTER_PROMPT.md`.
5. Lui demander de commencer par `TICKET-001` uniquement.
6. Valider chaque ticket avant de poursuivre.

## Base de données

Créer un fichier `.env` à partir de `.env.example`, puis renseigner une URL
PostgreSQL Neon dans `DATABASE_URL`. `DIRECT_URL` est recommandée pour les
migrations lorsque Neon fournit une URL de connexion directe distincte.

```bash
pnpm prisma:generate
pnpm prisma:migrate -- --name <nom-de-migration>
pnpm prisma:seed
pnpm prisma:check
```

`prisma:check` exécute une requête de santé et requiert une `DATABASE_URL`
valide. Le seed du ticket d’initialisation est volontairement vide ; le
programme exemple est importé dans TICKET-008.

## Déploiement Vercel

Le projet est configuré pour le preset Vite, une sortie statique dans `dist`
et une Function Node.js Hono unique sous `/api`. Toutes les routes existantes
sont regroupées derrière cette Function afin de rester sous la limite du plan
Hobby. Elle s’exécute dans la région `fra1`, proche de la base Neon européenne.
Le client Prisma généré est explicitement inclus dans son bundle, y compris ses
modules internes chargés dynamiquement.
Le build Vercel exécute dans l’ordre :

```bash
pnpm prisma:generate
pnpm prisma:deploy
pnpm build
```

`prisma:deploy` applique les migrations déjà versionnées avec
`prisma migrate deploy`. Il ne crée pas de migration et ne réinitialise jamais
la base.

Configurer les variables suivantes dans les environnements Preview et
Production du projet Vercel :

- `DATABASE_URL` : connexion Neon poolée utilisée à l’exécution ;
- `DIRECT_URL` : connexion Neon directe utilisée pendant les migrations ;
- `ADMIN_EMAIL` : adresse du compte propriétaire utilisée uniquement par le
  seed manuel.

`APP_URL` est réservée aux futurs liens absolus et peut être renseignée avec
l’origine HTTPS stable lorsqu’un domaine définitif est attribué. Elle n’est pas
lue par le runtime actuel.

Les valeurs réelles restent dans Vercel et dans les fichiers `.env` locaux
ignorés par Git. Après leur modification, un nouveau déploiement est nécessaire.
Le seed n’est volontairement pas lancé pendant le build : une migration de
production doit être automatique et idempotente, tandis qu’une modification de
contenu reste une opération explicite.

Pour reproduire le build Vercel localement puis contrôler un déploiement :

```bash
npx vercel@latest pull --environment=preview
npx vercel@latest build
pnpm deployment:check -- https://URL-DU-DEPLOIEMENT
```

Le contrôle vérifie l’application, le manifest installable, le service worker
et une Vercel Function. Sur iPhone, ouvrir ensuite l’URL HTTPS dans Safari,
utiliser **Partager → Sur l’écran d’accueil**, lancer LearnX depuis l’icône et
vérifier la navigation ainsi que la bannière hors ligne sur une page déjà
consultée.

La CI peut aussi fournir `DEPLOYMENT_CHECK_EMAIL` et
`DEPLOYMENT_CHECK_PASSWORD` à un compte de contrôle dédié. La commande vérifie
alors une connexion, la session, une lecture du curriculum puis la déconnexion,
sans créer ni modifier de contenu métier.

## Tests d’intégration réels

`pnpm test:integration` construit l’application puis exécute Chromium desktop,
Chromium mobile et WebKit mobile contre `api/index.ts`, Prisma et PostgreSQL,
sans interception de `/api`. La commande refuse toute écriture tant que les
variables suivantes ne désignent pas explicitement une branche Neon jetable :

- `DATABASE_URL` et `DIRECT_URL` de la branche isolée ;
- `NEON_BRANCH_ID` fourni lors de sa création ;
- `LEARNX_INTEGRATION_DATABASE=ephemeral` ;
- `LEARNX_INTEGRATION_RUN_ID`, unique pour l’exécution.

Le workflow `integration.yml` crée une branche Neon par exécution, applique les
migrations, injecte des fixtures dédiées via le parcours de test, puis supprime
la branche avec une étape `always()`. GitHub doit contenir le secret
`NEON_API_KEY` et la variable `NEON_PROJECT_ID`. Aucun identifiant ni URL de
base n’est versionné. Le workflow `deployment-check.yml`, déclenché manuellement,
utilise les secrets `LEARNX_DEPLOYMENT_EMAIL` et
`LEARNX_DEPLOYMENT_PASSWORD`, ainsi que la variable
`LEARNX_DEPLOYMENT_URL`.

## Authentification serveur

Les endpoints d’authentification sont des Vercel Functions sous `/api/auth` :

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

Les mots de passe sont hachés avec argon2id. Les sessions sont opaques, leur
hash est stocké dans PostgreSQL et le navigateur reçoit uniquement un cookie
`HttpOnly`, `SameSite=Lax` et `Secure` en production. Aucun token de session
n’est stocké dans `localStorage`.

## API de parcours

Les endpoints de lecture nécessitent une session LearnX active et ne renvoient
que les programmes actifs et les contenus publiés :

- `GET /api/programs`
- `GET /api/programs/:programSlug`
- `GET /api/programs/:programSlug/stages/:stageSlug`
- `GET /api/modules/:moduleSlug`
- `GET /api/lessons/:lessonSlug`

## API de progression

Les mutations de progression nécessitent également une session active. Elles
vérifient l’appartenance de la leçon, tâche ou ressource au programme de
l’utilisateur avant toute écriture :

- `GET /api/lessons/:lessonId/progress`
- `POST /api/lessons/:lessonId/start`
- `POST /api/lessons/:lessonId/complete`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/resources/:resourceId/progress`

La progression de leçon est calculée côté serveur à partir des tâches
obligatoires (40 %), quiz obligatoires réussis (30 %), exercices obligatoires
soumis (20 %) et ressources obligatoires terminées (10 %). Les catégories
absentes voient leur poids redistribué. Les mini-évaluations ne sont pas
comptées une seconde fois : toute notion obligatoire doit néanmoins être
maîtrisée pour terminer la leçon. La consultation d’une ressource ne valide
jamais une notion.

Les mutations et leurs agrégats leçon, étape et programme sont persistés dans
une transaction sérialisable. Pour contrôler puis réparer les progressions
existantes sans mutation implicite :

```bash
pnpm progress:recalculate -- --user-id <uuid>
pnpm progress:recalculate -- --user-id <uuid> --apply
```

Sans `--apply`, la commande reste en simulation. Un `--program-id` peut réduire
le périmètre ; `--all` doit être fourni explicitement pour couvrir tous les
programmes.

## Documents

- `PRODUCT_REQUIREMENTS.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `PRISMA_NOTES.md`
- `UX_SPEC.md`
- `TIMELINE_SPEC.md`
- `ASSESSMENT_SPEC.md`
- `EDITORIAL_GUIDELINES.md`
- `PEDAGOGY_AUTHORING_GUIDE.md`
- `CURRICULUM_BLUEPRINT.md`
- `PEDAGOGY_CHANGE_POLICY.md`
- `SAMPLE_PROGRAM_PSYCHOLOGY.md`
- `BACKLOG_CODEX.md`
- `CODEX_MASTER_PROMPT.md`
- `AGENTS.md`
- `seed/sample-program.json`
- `.env.example`
