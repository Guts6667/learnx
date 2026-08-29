import { createDefaultTrialAllocation } from '../src/server/credits/default-trial-allocation.ts';

/**
 * Grants the monthly trial allocation to every account in a trial cohort
 * (V4.5-163C). Meant to run once a day; V4.5-173 schedules it.
 *
 *   pnpm trial:grant-cycle
 *
 * Daily rather than monthly on purpose: the grant is idempotent per cycle, so
 * a daily run costs nothing after the first success of a month and picks up
 * accounts activated mid-cycle, or missed while the breaker was open, without
 * anyone noticing they were missed.
 */

async function main(): Promise<number> {
  const { prisma } = await import('../src/server/prisma.ts');
  try {
    const allocation = await createDefaultTrialAllocation();
    const users = await prisma.user.findMany({
      select: { id: true },
      where: { accountStatus: 'ACTIVE', cohort: 'TRIAL' },
    });

    const tally = { alreadyGranted: 0, granted: 0, other: 0, suspended: 0 };
    for (const user of users) {
      const outcome = await allocation.grantForCycle(user.id);
      if (outcome.kind === 'GRANTED') tally.granted += 1;
      else if (outcome.kind === 'ALREADY_GRANTED') tally.alreadyGranted += 1;
      else if (outcome.kind === 'SUSPENDED') tally.suspended += 1;
      else tally.other += 1;
    }

    process.stdout.write(
      `Cycle d'essai : ${tally.granted} versée(s), ${tally.alreadyGranted} déjà versée(s), ${tally.suspended} suspendue(s), ${tally.other} sans politique ou refusée(s).\n`,
    );
    // A suspended cycle is not a failure of this job: the breaker is doing its
    // work, and the run says so rather than exiting red on a healthy refusal.
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
