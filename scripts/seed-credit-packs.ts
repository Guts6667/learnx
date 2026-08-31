import {
  seedCreditPacks,
  type CreditPackSeedPorts,
} from '../src/server/maintenance/credit-pack-seed';
import { prisma } from '../src/server/prisma';

/**
 * Writes the purchasable pack grid (V4.5-212).
 *
 *   pnpm db:target -- --url '<…>' --yes seed-packs
 *
 * Reached only through `db:target`, which names the database explicitly and
 * sets both connection variables from that one name. This file does not import
 * `dotenv/config`: reading `.env` is what sent a preview command to production
 * on 30 August 2026 (V4.5-192).
 *
 * Idempotent: it upserts by key, so running it twice writes the same grid.
 * Unlike the preview seed it does not refuse a populated database — a grid is
 * meant to be re-applied when the document that decides it changes — which is
 * why `db:target` classes it as destructive and asks for `--yes`.
 */

async function main() {
  // One transaction: a failure between two tiers would leave a grid that is
  // neither the old one nor the new one, on the page where people spend money.
  const result = await prisma.$transaction(async (transaction) => {
    const ports: CreditPackSeedPorts = {
      deactivatePack: async (key) => {
        const { count } = await transaction.creditPack.updateMany({
          data: { active: false },
          where: { active: true, key },
        });
        return count;
      },
      upsertPack: async (input) => {
        await transaction.creditPack.upsert({
          create: input,
          update: input,
          where: { key: input.key },
        });
      },
    };
    return seedCreditPacks(ports);
  });

  console.log(
    `Paliers écrits : ${result.seeded.join(', ')}.` +
      (result.deactivated.length > 0
        ? ` Désactivés : ${result.deactivated.join(', ')}.`
        : ' Aucun palier à désactiver.'),
  );
}

await main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
