# LearnX

LearnX est une PWA mobile-first et modulaire permettant de suivre des parcours
d’apprentissage autonomes. La V3 fait évoluer le produit vers un accès
multi-utilisateur approuvé et des programmes publiés partageables.

L’application n’est pas limitée à la psychologie. Chaque sujet est organisé sous forme de programme, lui-même découpé en étapes, modules et leçons.

La V2 est clôturée. Le travail courant est ordonné dans `BACKLOG_V3.md` et les
documents à consulter par type de tâche sont répertoriés dans `docs/INDEX.md`.
Les backlogs et rapports V1/V2 sont conservés sous `docs/archive/` à titre de
preuve historique uniquement.

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

Le parcours d’apprentissage utilise la leçon comme contexte permanent. La page
compose les blocs, ressources, tâches, mini-évaluations, exercices et quiz dans
une séquence déterministe et expose une seule action principale « Continuer ».
Les routes profondes conservent le fil d’Ariane et le sommaire de la leçon ; la
route canonique d’un exercice est
`/program/:programSlug/lesson/:lessonSlug/exercise/:exerciseId`.

## Travail avec Codex

1. Lire `AGENTS.md` et `docs/INDEX.md`.
2. Identifier le ticket actif dans `BACKLOG_V3.md`.
3. Charger uniquement l'ADR, la spécification et les fichiers concernés.
4. Traiter un seul ticket et un seul périmètre par commit.
5. Ne jamais utiliser les archives V1/V2 comme instructions actives.

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
valide. `pnpm prisma:seed` importe le bundle versionné
`seed/sample-program.json`. Ne pas exécuter le seed sur une base partagée sans
avoir vérifié la cible et le plan d'import.

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
- `APP_URL` : origine HTTPS stable utilisée dans les liens de vérification ;
- `LEARNX_EMAIL_VERIFICATION_ENABLED` : active explicitement l'envoi des liens ;
- `LEARNX_EMAIL_VERIFICATION_TTL_MS` : durée de validité, entre 5 minutes et
  7 jours ;
- `LEARNX_ACCESS_INVITATION_TTL_MS` : durée de validité des invitations
  d’activation, entre 5 minutes et 7 jours ;
- `LEARNX_EMAIL_FROM` : expéditeur appartenant à un domaine Resend vérifié ;
- `RESEND_API_KEY` : secret serveur Resend, jamais exposé au client.

L'envoi des vérifications et invitations est désactivé tant que
`LEARNX_EMAIL_VERIFICATION_ENABLED` n'est pas `true`. Une désactivation
n'efface ni les demandes, ni les vérifications, ni les invitations déjà émises.
L'adaptateur fournisseur est isolé dans le serveur : un autre fournisseur peut
remplacer Resend sans modifier le cycle de demande. Les liens placent leur
token dans le fragment URL afin qu'il ne soit pas transmis dans les logs HTTP ;
seul son hash SHA-256 est conservé en base.

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

- `POST /api/auth/register` — développement et intégration uniquement ; refusé
  par défaut en production en attendant le workflow d’accès V3
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

Les mots de passe sont hachés avec argon2id. Les sessions sont opaques, leur
hash est stocké dans PostgreSQL et le navigateur reçoit uniquement un cookie
`HttpOnly`, `SameSite=Lax` et `Secure` en production. Aucun token de session
n’est stocké dans `localStorage`.

Les échecs de connexion sont limités à cinq par fenêtre de quinze minutes. Le
compteur est partagé dans PostgreSQL entre les Functions serverless ; sa clé
IP/e-mail est hachée avant stockage.

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

## Publication administrateur

La zone `/admin` charge la hiérarchie progressivement et conserve le niveau
actif dans l’URL. Les lectures propriétaires sont séparées par niveau :

- `GET /api/admin/programs` liste uniquement les programmes du compte admin ;
- `GET /api/admin/programs/:programId` charge ses étapes immédiates ;
- `GET /api/admin/stages/:stageId` charge ses modules immédiats ;
- `GET /api/admin/modules/:moduleId` charge ses leçons immédiates ;
- `GET /api/admin/lessons/:lessonId` charge la leçon et son fil d’Ariane.

Chaque lecture vérifie le rôle administrateur et la propriété côté serveur. Les
détails et actions du niveau actif s’ouvrent dans un tiroir accessible sans
charger le reste de l’arbre.

Les cascades programme, étape et module utilisent toujours deux requêtes :

- `POST /api/admin/publication/preview` calcule les changements, avertissements,
  préconditions manquantes et un `planId` sans modifier la base ;
- `POST /api/admin/publication/apply` confirme exactement ce plan dans une
  transaction sérialisable.

Une confirmation obsolète est refusée. Répéter un plan déjà appliqué reste sans
effet. La dépublication peut masquer uniquement le parent ou désactiver toute
la branche ; dans les deux cas, progressions, tentatives, notes et soumissions
sont conservées. Les contrôles portent seulement sur la complétude pédagogique
et jamais sur une éventuelle validation scientifique.

## Documents

- `docs/INDEX.md`
- `BACKLOG_V3.md`
- `ADR_001_MULTI_USER_ACCESS.md`
- `PRODUCT_REQUIREMENTS.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `PRISMA_NOTES.md`
- `UX_SPEC.md`
- `TIMELINE_SPEC.md`
- `ASSESSMENT_SPEC.md`
- `EDITORIAL_GUIDELINES.md`
- `PEDAGOGY_AUTHORING_GUIDE.md`
- `PEDAGOGY_CHANGE_POLICY.md`
- `content/fondamentaux-psychologie/CURRICULUM_BLUEPRINT.md`
- `content/fondamentaux-psychologie/README.md`
- `LEARNING_FLOW_V3_SPEC.md`
- `SCIENTIFIC_REVIEW_SPEC.md`
- `CODEX_MASTER_PROMPT.md`
- `AGENTS.md`
- `seed/sample-program.json`
- `.env.example`

Les documents V1/V2 se trouvent dans `docs/archive/` et ne sont pas chargés par
défaut.
