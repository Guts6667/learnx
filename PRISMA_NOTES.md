# Prisma Implementation Notes

## ORM

LearnX utilise Prisma ORM.

## Fichiers attendus

```text
prisma/
├── schema.prisma
├── migrations/
└── seed.ts

src/server/
└── prisma.ts
```

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
  conserve les identifiants pédagogiques nécessaires aux futurs enrollments.
- Le seed doit être idempotent.
- Les accès utilisateurs doivent toujours inclure un filtre par `userId`.
- Les limites d’authentification partagées utilisent `login_rate_limits` et une
  incrémentation SQL atomique ; aucune clé IP/e-mail brute n’est persistée.
- Les demandes d'accès réutilisent ce stockage avec un namespace distinct et
  des clés IP/e-mail hachées ; l'index partiel d'`access_requests` garantit une
  seule demande ouverte par adresse normalisée.
