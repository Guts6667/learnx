# LearnX — Kit de transmission Codex

LearnX est une PWA privée, mobile-first et modulaire permettant de suivre des parcours d’apprentissage autonomes.

L’application n’est pas limitée à la psychologie. Chaque sujet est organisé sous forme de programme, lui-même découpé en étapes, modules et leçons.

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

## Documents

- `PRODUCT_REQUIREMENTS.md`
- `TECHNICAL_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `PRISMA_NOTES.md`
- `UX_SPEC.md`
- `TIMELINE_SPEC.md`
- `ASSESSMENT_SPEC.md`
- `SAMPLE_PROGRAM_PSYCHOLOGY.md`
- `BACKLOG_CODEX.md`
- `CODEX_MASTER_PROMPT.md`
- `AGENTS.md`
- `seed/sample-program.json`
- `.env.example`
