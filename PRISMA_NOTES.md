# Prisma Implementation Notes

## ORM

LearnX utilise Prisma ORM.

## Fichiers attendus

```text
prisma/
├── schema.prisma
├── models/
│   ├── ai-correction-enums.prisma
│   ├── ai-correction.prisma
│   ├── assessment-enums.prisma
│   ├── assessments-progress.prisma
│   ├── credits-pricing-enums.prisma
│   ├── credits-pricing.prisma
│   ├── identity-access-enums.prisma
│   ├── identity-access.prisma
│   ├── learning-enums.prisma
│   ├── learning-runtime.prisma
│   └── program-catalog.prisma
├── migrations/
└── seed.ts

src/server/
└── prisma.ts
```

`prisma.config.ts` désigne le dossier `prisma/`, conformément au mode
multi-file de Prisma. `schema.prisma` conserve uniquement le générateur et la
datasource ; les déclarations métier sont réparties par domaine sous
`prisma/models/`. Les migrations restent au même niveau et leur historique ne
doit jamais être régénéré pour un simple déplacement de déclaration.

## Client Prisma

Créer un singleton côté serveur afin d’éviter la multiplication des connexions en développement.

Exemple attendu :

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

## Commandes

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

## Contraintes

- Prisma Client n’est utilisé que côté serveur.
- Aucun import de Prisma dans le bundle frontend.
- Les migrations sont versionnées.
- Les publications de programme produisent une `ProgramVersion` immuable dans
  la même transaction sérialisable que les changements de publication.
- Le snapshot de version exclut les timestamps techniques de son checksum et
  conserve les identifiants pédagogiques nécessaires aux enrollments.
- Une `ProgramEnrollment` est unique par utilisateur et programme, pointe vers
  une version du même programme et n'est jamais supprimée lors d'une
  désinscription.
- Une publication ultérieure ne change pas silencieusement la version suivie ;
  la migration volontaire de version relève d'une opération séparée.
- Le seed doit être idempotent.
- Les accès utilisateurs doivent toujours inclure un filtre par `userId`.
- Les limites d’authentification partagées utilisent `login_rate_limits` et une
  incrémentation SQL atomique ; aucune clé IP/e-mail brute n’est persistée.
- Les demandes d'accès réutilisent ce stockage avec un namespace distinct et
  des clés IP/e-mail hachées ; l'index partiel d'`access_requests` garantit une
  seule demande ouverte par adresse normalisée.
