import { hashPassword } from '../src/server/api/_lib/password';
import {
  seedPreview,
  type PreviewSeedPorts,
  type PreviewSeedResult,
} from '../src/server/maintenance/preview-seed';
import { prisma } from '../src/server/prisma';

/**
 * Seeds an empty preview database for the Stripe sandbox pass.
 *
 *   SEED_PREVIEW_PASSWORD='…' pnpm db:target -- --url '<…>' seed-preview
 *
 * Reached only through `db:target`, which names the database explicitly and
 * sets both connection variables from that one name. This file no longer
 * imports `dotenv/config`: reading `.env` is what sent a preview command to
 * production on 30 August 2026 (V4.5-192). It refuses any
 * database that already holds an account, so pointing it at production or at a
 * populated branch does nothing but print why.
 */

function describe(result: PreviewSeedResult): {
  message: string;
  ok: boolean;
} {
  switch (result.kind) {
    case 'SEEDED':
      return {
        message: [
          `Compte créé : ${result.email}`,
          `Pack actif : ${result.packKey} — 10 crédits, 1,00 €`,
          'Mot de passe : celui de SEED_PREVIEW_PASSWORD (non affiché).',
        ].join('\n'),
        ok: true,
      };
    case 'REFUSED_PRODUCTION':
      return {
        message:
          "Refus : NODE_ENV vaut 'production'. Ce script ne sème que des bases de préversion.",
        ok: false,
      };
    case 'REFUSED_DATABASE_NOT_EMPTY':
      return {
        message: [
          `Refus : la base contient déjà ${result.users} compte(s).`,
          'Elle doit être vide. Une base de préversion se crée vide puis se',
          'sème — jamais par clonage de la production, qui copierait les',
          'données réelles (docs/V4_5_RGPD_AUDIT.md §2–§3, constat E4).',
        ].join('\n'),
        ok: false,
      };
    case 'REFUSED_PASSWORD_MISSING':
      return {
        message:
          'Refus : SEED_PREVIEW_PASSWORD est absent. Aucun mot de passe par défaut ne sera inventé.',
        ok: false,
      };
    case 'REFUSED_PASSWORD_TOO_SHORT':
      return {
        message:
          'Refus : douze caractères minimum, comme à la connexion. Plus court, le compte serait créé puis refusé à la connexion.',
        ok: false,
      };
    case 'REFUSED_PASSWORD_TOO_LONG':
      return {
        message: 'Refus : cent vingt-huit caractères au maximum.',
        ok: false,
      };
  }
}

async function main() {
  // One transaction, so a failure between the account and the pack cannot
  // leave a half-seeded database that the emptiness guard would then refuse to
  // repair.
  const result = await prisma.$transaction(async (transaction) => {
    const ports: PreviewSeedPorts = {
      countUsers: () => transaction.user.count(),
      createPack: async (input) => {
        const pack = await transaction.creditPack.create({
          data: { ...input, position: 0 },
          select: { key: true },
        });

        return pack;
      },
      createUser: async (input) => {
        const user = await transaction.user.create({
          data: input,
          select: { id: true },
        });

        return user;
      },
      hashPassword,
    };

    return seedPreview({
      nodeEnv: process.env.NODE_ENV,
      password: process.env.SEED_PREVIEW_PASSWORD,
      ports,
    });
  });

  const outcome = describe(result);
  console.log(outcome.message);
  if (!outcome.ok) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
