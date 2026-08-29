import { PrismaCorrectionBreaker } from '../src/server/corrections/correction-breaker.ts';
import { PrismaCorrectionCostAudit } from '../src/server/corrections/correction-cost-audit.ts';
import { PrismaCorrectionMonitoringService } from '../src/server/corrections/correction-monitoring.ts';
import { formatWeeklyCorrectionReport } from '../src/server/corrections/correction-weekly-report.ts';

/**
 * Prints the weekly AI correction report (V4.5-142, quality contract §6).
 *
 * Read-only: it never trips the breaker, never writes, and never sends. It is
 * meant to be run by a person or a scheduler and its output pasted or piped —
 * a report that could change the thing it reports on would be a worse report.
 *
 *   pnpm tsx scripts/ai-weekly-report.ts
 */

async function main(): Promise<void> {
  const { prisma } = await import('../src/server/prisma.ts');
  const breaker = new PrismaCorrectionBreaker(prisma);
  const monitoring = new PrismaCorrectionMonitoringService(prisma, breaker);
  const until = new Date();
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1_000);

  const [summary, events, unknownCost] = await Promise.all([
    monitoring.summary(),
    prisma.aiCorrectionBreakerEvent.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        action: true,
        actor: { select: { email: true } },
        alertError: true,
        alertedAt: true,
        createdAt: true,
        rate: true,
        reason: true,
      },
      where: { createdAt: { gte: since, lte: until } },
    }),
    new PrismaCorrectionCostAudit(prisma).report(),
  ]);

  process.stdout.write(
    `${formatWeeklyCorrectionReport({
      journal: events.map((event) => ({
        action: event.action,
        actorEmail: event.actor?.email ?? null,
        alertError: event.alertError,
        alertedAt: event.alertedAt,
        createdAt: event.createdAt,
        rate: event.rate,
        reason: event.reason,
      })),
      summary,
      week: { since, until },
    })}\n`,
  );

  if (unknownCost.attempts.length > 0) {
    process.stdout.write(
      `\nTentatives sans coût sur 24 h (${unknownCost.attempts.length}) :\n${unknownCost.attempts
        .map(
          (attempt) =>
            `  correction ${attempt.correctionId} · tentative ${attempt.attemptId} · fournisseur ${attempt.providerRequestId ?? 'inconnu'}`,
        )
        .join('\n')}\n`,
    );
  }

  await prisma.$disconnect();
}

await main();
