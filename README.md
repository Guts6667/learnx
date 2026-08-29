# LearnX

LearnX is a modular, mobile-first PWA for self-directed learning paths. V4.1 is
released: it rebuilt the front end on React 19 with shadcn "Maia" primitives over
the LearnX design tokens, decomposed the API, Prisma schema, i18n catalogs and
CSS, and raised the quality gates, all at constant product behaviour.

The application is not limited to psychology. Each subject is organized as a
program, which is divided into stages, modules, and lessons.

V4.1 is closed. Start from `docs/HANDOFF.md`, then `docs/INDEX.md` for the
document that matches your task. `V4_5_BACKLOG.md` holds the next tranche.
Earlier backlogs (`BACKLOG_V3.md`, `BACKLOG_V3_5.md`, `BACKLOG_V4.md`,
`V4_1_BACKLOG.md`) and the reports under `docs/archive/` are historical evidence,
never active instructions.

## Required stack

- React 19 — the only UI runtime; Preact was removed in V4.1 and a
  `quality:imports` gate fails the build if any Preact import returns
- React Router
- TanStack Query
- shadcn primitives on the "Maia" style, bound to the LearnX design tokens
- Vite
- Strict TypeScript
- PostgreSQL
- Prisma ORM, multi-file schema under `prisma/models/`
- Tailwind CSS
- Vercel
- Vercel Functions
- PWA with `vite-plugin-pwa`
- Vitest
- React Testing Library
- Playwright

## Learning architecture

```text
Program
└── Stage
    └── Module
        └── Lesson
            ├── Content blocks
            ├── Resources
            ├── Tasks
            ├── Quizzes
            ├── Exercises
            └── Reviews
```

The structure remains independent of academic years and semesters, but each
program and stage may have an indicative duration. When a user starts a program
or stage, LearnX calculates a target end date and compares actual progress with
expected progress.

The learning path uses the lesson as its permanent context. The page composes
content blocks, resources, tasks, mini-assessments, exercises, and quizzes into
a deterministic sequence and exposes a single primary “Continue” action. Deep
routes preserve the breadcrumb and lesson outline; the canonical route for an
exercise is
`/program/:programSlug/lesson/:lessonSlug/exercise/:exerciseId`.

## Working on a ticket

1. Read `AGENTS.md`, then `docs/HANDOFF.md` and `docs/INDEX.md`.
2. Identify the active ticket in the current backlog.
3. Read `docs/ENGINEERING_CONVENTIONS.md` before writing code, and
   `docs/TESTING_AND_RELEASE.md` before a preview or a promotion.
4. Load only the ADR, specification, and files that ticket names.
5. Handle a single ticket and a single scope per commit.
6. Never treat an archived backlog as an active instruction. An older document
   naming Preact or a closed backlog cannot reintroduce those choices.

## Database

Create a `.env` file from `.env.example`, then provide a Neon PostgreSQL URL in
`DATABASE_URL`. `DIRECT_URL` is recommended for migrations when Neon provides a
separate direct connection URL.

```bash
pnpm prisma:generate
pnpm prisma:migrate -- --name <migration-name>
pnpm prisma:seed
pnpm prisma:check
```

`prisma:check` runs a health query and requires a valid `DATABASE_URL`.
`pnpm prisma:seed` imports the versioned `seed/sample-program.json` bundle. Do
not run the seed against a shared database without first verifying the target
and import plan.

## Vercel deployment

The project is configured with the Vite preset, static output in `dist`, and a
single Hono Node.js Function under `/api`. All existing routes are grouped
behind this Function to remain within the Hobby plan limit. It runs in the
`fra1` region, close to the European Neon database. The generated Prisma client
is explicitly included in its bundle, including its dynamically loaded internal
modules.

The Vercel build runs, in order:

```bash
pnpm prisma:generate
pnpm vercel:migrate
pnpm build
```

`vercel:migrate` applies already versioned migrations with
`prisma migrate deploy`, but **only when `VERCEL_ENV` is `production`**. On
preview deployments it prints a skip line and exits successfully, so an
unreviewed branch can never migrate a database during its build. It does not
create migrations and never resets the database.

A preview deployment therefore expects its schema to be already applied. When
the staging tier gets its own Neon branch, its migrations must be applied
deliberately rather than as a side effect of a build.

Configure the following variables in the Preview and Production environments
of the Vercel project:

- `DATABASE_URL`: pooled Neon connection used at runtime;
- `DIRECT_URL`: direct Neon connection used during migrations;
- `ADMIN_EMAIL`: owner account address used only by the manual seed;
- `APP_URL`: stable HTTPS origin used in verification links;
- `LEARNX_EMAIL_VERIFICATION_ENABLED`: explicitly enables sending links;
- `LEARNX_EMAIL_VERIFICATION_TTL_MS`: validity period, from 5 minutes to
  7 days;
- `LEARNX_ACCESS_INVITATION_TTL_MS`: activation invitation validity period,
  from 5 minutes to 7 days;
- `LEARNX_EMAIL_FROM`: sender belonging to a verified Resend domain;
- `RESEND_API_KEY`: Resend server secret, never exposed to the client.

Verification and invitation delivery remains disabled until
`LEARNX_EMAIL_VERIFICATION_ENABLED` is `true`. Disabling it does not delete
requests, verifications, or invitations that have already been issued. In
Production, `LEARNX_ACCESS_REQUESTS_ENABLED` must also be `true`. Without this
explicit activation, the endpoint returns `503`. If the feature is enabled
while `APP_URL`, `LEARNX_EMAIL_FROM`, `RESEND_API_KEY`, or email verification is
missing, the endpoint fails in the same way before any write: no unverifiable
`PENDING_EMAIL` request is created. The provider adapter is isolated on the
server, so another provider can replace Resend without changing the request
lifecycle. Links place their token in the URL fragment so it is not transmitted
in HTTP logs; only its SHA-256 hash is stored in the database.

Real values remain in Vercel and in local `.env` files ignored by Git. A new
deployment is required after changing them. The seed is deliberately not run
during the build: a production migration must be automatic and idempotent,
whereas a content change remains an explicit operation.

To reproduce the Vercel build locally and then check a deployment:

```bash
npx vercel@latest pull --environment=preview
npx vercel@latest build
pnpm deployment:check -- https://DEPLOYMENT-URL
```

The check verifies the application, installable manifest, service worker, and a
Vercel Function. On iPhone, then open the HTTPS URL in Safari, use
**Share → Add to Home Screen**, launch LearnX from the icon, and verify
navigation and the offline banner on a page that has already been visited.

CI can also provide `DEPLOYMENT_CHECK_EMAIL` and `DEPLOYMENT_CHECK_PASSWORD` for
a dedicated test account. The command then verifies login, the session, a
curriculum read, the V4 correction preflight, and logout without creating or
modifying business content. Set `DEPLOYMENT_CHECK_AI_EXPECTED_STATE` when the
deployment must expose a specific safe state, for example
`CONFIGURED_CLOSED` before an owner-authorized smoke test.

## Expired technical data maintenance

The following command only inventories technical records eligible for cleanup
and does not modify any data by default:

```bash
pnpm maintenance:cleanup
```

It covers sessions expired for more than 7 days, rate-limit buckets older than
24 hours, and completed email verifications or invitations older than 30 days.
Users, access requests, audit events, notes, progress records, attempts, and
content are never targeted.

Deletion requires the explicit `--apply` option:

```bash
pnpm maintenance:cleanup --apply
```

Each run is bounded in batches and can be replayed safely. The
`LEARNX_RETENTION_*` values in `.env.example` allow the policy to be adjusted.
Always start with the dry run, verify the target `DATABASE_URL` and its backup,
and only then run `--apply`. No automatic cleanup is triggered by a build or
deployment.

## Real integration tests

`pnpm test:integration` builds the application and then runs desktop Chromium,
mobile Chromium, and mobile WebKit against `api/index.ts`, Prisma, and
PostgreSQL without intercepting `/api`. The command refuses all writes unless
the following variables explicitly identify a disposable Neon branch:

- `DATABASE_URL` and `DIRECT_URL` for the isolated branch;
- `NEON_BRANCH_ID` provided when it was created;
- `LEARNX_INTEGRATION_DATABASE=ephemeral`;
- `LEARNX_INTEGRATION_RUN_ID`, unique to the run.

The `integration.yml` workflow creates one Neon branch per run, applies
migrations, injects dedicated fixtures through the test flow, and then deletes
the branch in an `always()` step. GitHub must contain the `NEON_API_KEY` secret
and the `NEON_PROJECT_ID` variable. No database credentials or URLs are
versioned. The manually triggered `deployment-check.yml` workflow uses the
`LEARNX_DEPLOYMENT_EMAIL` and `LEARNX_DEPLOYMENT_PASSWORD` secrets together
with the `LEARNX_DEPLOYMENT_URL` variable.

## Server authentication

Authentication endpoints are Vercel Functions under `/api/auth`:

- `POST /api/auth/register` — development and integration only; rejected by
  default in production pending the V3 access workflow
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

Passwords are hashed with argon2id. Sessions are opaque, their hash is stored in
PostgreSQL, and the browser receives only an `HttpOnly`, `SameSite=Lax`, and
production-only `Secure` cookie. No session token is stored in `localStorage`.

A suspended account can neither open a new session nor reuse an existing one.
The `/admin/accounts` administration interface revokes all sessions in the
suspension transaction. Reactivation preserves notes, progress records,
attempts, and submissions, but requires a new login.

Login failures are limited to five per fifteen-minute window. The counter is
shared in PostgreSQL across serverless Functions; its IP/email key is hashed
before storage.

## Curriculum API

Read endpoints require an active LearnX session and return only active programs
and published content:

- `GET /api/programs`
- `GET /api/programs/:programSlug`
- `GET /api/programs/:programSlug/stages/:stageSlug`
- `GET /api/modules/:moduleSlug`
- `GET /api/lessons/:lessonSlug`

## Progress API

Progress mutations also require an active session. Before writing, they verify
that the lesson, task, or resource belongs to the user's program:

- `GET /api/lessons/:lessonId/progress`
- `POST /api/lessons/:lessonId/start`
- `POST /api/lessons/:lessonId/complete`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/resources/:resourceId/progress`

Lesson progress is calculated server-side from required tasks (40%), passed
required quizzes (30%), submitted required exercises (20%), and completed
required resources (10%). Missing categories have their weight redistributed.
Mini-assessments are not counted a second time, but every required concept must
still be mastered to complete the lesson. Viewing a resource never validates a
concept.

Mutations and their lesson, stage, and program aggregates are persisted in a
serializable transaction. To inspect and then repair existing progress without
implicit mutation:

```bash
pnpm progress:recalculate -- --user-id <uuid>
pnpm progress:recalculate -- --user-id <uuid> --apply
```

Without `--apply`, the command remains a dry run. A `--program-id` can narrow
the scope; `--all` must be provided explicitly to cover all programs.

## Administrator publishing

The `/admin` area loads the hierarchy progressively and keeps the active level
in the URL. Owner reads are separated by level:

- `GET /api/admin/programs` lists only programs belonging to the admin account;
- `GET /api/admin/programs/:programId` loads its immediate stages;
- `GET /api/admin/stages/:stageId` loads its immediate modules;
- `GET /api/admin/modules/:moduleId` loads its immediate lessons;
- `GET /api/admin/lessons/:lessonId` loads the lesson and its breadcrumb.

Each read verifies the administrator role and ownership server-side. Details
and actions for the active level open in an accessible drawer without loading
the rest of the tree.

Program, stage, and module cascades always use two requests:

- `POST /api/admin/publication/preview` calculates changes, warnings, missing
  prerequisites, and a `planId` without modifying the database;
- `POST /api/admin/publication/apply` confirms that exact plan in a serializable
  transaction.

A stale confirmation is rejected. Repeating an already applied plan has no
effect. Unpublishing can hide only the parent or disable the entire branch; in
both cases, progress records, attempts, notes, and submissions are preserved.
Checks cover pedagogical completeness only and never any potential scientific
validation.

## Documents

Start here:

- `docs/HANDOFF.md` — current state, operation, debt and rollback
- `docs/INDEX.md` — routing to every other document
- `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md`
- `docs/ENGINEERING_CONVENTIONS.md`, `docs/TESTING_AND_RELEASE.md`
- `docs/AGENT_WORKFLOW.md` — ticket assignment, isolation, review, promotion
- `V4_5_BACKLOG.md` — the next tranche

Reference:

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
- `LEARNING_FLOW_V3_SPEC.md` (behavioural baseline, still current)
- `SCIENTIFIC_REVIEW_SPEC.md`
- `CODEX_MASTER_PROMPT.md`
- `AGENTS.md`
- `seed/sample-program.json`
- `.env.example`

V1 and V2 documents are located in `docs/archive/` and are not loaded by
default.
