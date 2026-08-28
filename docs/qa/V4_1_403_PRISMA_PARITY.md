# V4.1-403 — preuve de parité Prisma multi-file

- Baseline : `d1acaa8b`
- Branche de travail : `codex/v4-1-403`
- Date : 2026-08-28
- Prisma CLI et client : `7.9.1`

## Invariants vérifiés

- `prisma/schema.prisma` reste au même niveau que `prisma/migrations/`.
- `prisma.config.ts` désigne le dossier officiellement supporté `prisma/`.
- Les 42 répertoires de migration sont conservés ; aucun fichier de migration
  n'est ajouté ou modifié.
- Les 50 enums et 63 modèles sont répartis par domaine sous `prisma/models/`.
- Le schéma relationnel et le modèle runtime généré restent identiques.

## Diff de schéma

Le monofichier de la baseline a été extrait hors Git, puis comparé au dossier
multi-file :

```bash
pnpm exec prisma migrate diff \
  --from-schema /tmp/learnx-v41-403-before.prisma \
  --to-schema prisma \
  --exit-code
```

Résultat : `No difference detected.` et code de sortie `0`.

Le `runtimeDataModel` produit avant et après a ensuite été canoniquement trié
et comparé. Les deux documents contiennent 63 modèles et ont le même SHA-256 :

```text
9faa2e4a7e4ccea405ca9e34b597755ef7ad9c89024e63406659c99f0a3393d4
```

La comparaison est reproductible depuis le dépôt sans dépendre des fichiers
temporaires du run initial :

```bash
git show d1acaa8b:prisma/schema.prisma \
  > /tmp/learnx-v41-403-before-generate.prisma
perl -0pi -e \
  's#output   = "\.\./generated/prisma"#output   = "./learnx-v41-403-generated-before"#' \
  /tmp/learnx-v41-403-before-generate.prisma
pnpm exec prisma generate \
  --schema /tmp/learnx-v41-403-before-generate.prisma
pnpm exec prisma generate --schema prisma
node - <<'NODE'
const { readFileSync } = require('node:fs');

function runtimeDataModel(path) {
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .find((candidate) =>
      candidate.startsWith('config.runtimeDataModel = JSON.parse('),
    );
  if (!line) throw new Error(`runtimeDataModel absent de ${path}`);
  const prefix = 'config.runtimeDataModel = JSON.parse(';
  return JSON.parse(JSON.parse(line.slice(prefix.length, -1)));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

const before = canonical(
  runtimeDataModel(
    '/tmp/learnx-v41-403-generated-before/internal/class.ts',
  ),
);
const after = canonical(runtimeDataModel('generated/prisma/internal/class.ts'));
if (JSON.stringify(before) !== JSON.stringify(after)) process.exit(1);
console.log(`runtime data model parity: ${Object.keys(after.models).length}`);
NODE
```

Le premier `generate` écrit uniquement sous `/tmp`; le second régénère le
client local normal. La canonicalisation trie les clés d'objet mais conserve
l'ordre des champs, afin de neutraliser seulement l'ordre des fichiers Prisma.

## Historique de migration

Un manifeste SHA-256 de tous les fichiers suivis sous `prisma/migrations/` a
été calculé avant et après le découpage. Les deux manifestes ont le même hash :

```text
0a047ffd3385f8c46d01ea4bb60a03f2d02aad08d1fcf079247604de6ec58d9e
```

`git diff --name-only -- prisma/migrations` ne retourne aucun chemin.

## Commandes de validation

```bash
pnpm exec prisma format --schema prisma
pnpm exec prisma validate --schema prisma
pnpm exec prisma generate --schema prisma
pnpm vitest run prisma/multi-file-schema.test.ts prisma/*schema.test.ts \
  prisma/seed.test.ts src/server/maintenance/migration-rehearsal.test.ts \
  src/server/quality/public-contacts.test.ts
pnpm lint
pnpm typecheck
NODE_OPTIONS=--no-experimental-webstorage pnpm test
pnpm build
```

Résultats :

- contrats Prisma, seed idempotent et répétition de migration : 121/121 ;
- suite complète : 1 050/1 050 ;
- lint et typecheck : verts ;
- build et génération PWA : verts.

La répétition sur clone est couverte par le test existant du plan de
`migration-rehearsal`. Aucune base distante n'a été créée ou modifiée pour ce
ticket de réorganisation sans changement SQL.
