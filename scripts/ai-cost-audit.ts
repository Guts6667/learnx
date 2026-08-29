import {
  PrismaCorrectionCostAudit,
  costAuditExitCode,
} from '../src/server/corrections/correction-cost-audit.ts';
import { ownerAlert } from '../src/server/corrections/owner-alert.ts';

/**
 * Reports provider costs that never arrived, and tells the owner (V4.5-142,
 * quality contract §6). Meant to run daily; V4.5-173 schedules it.
 *
 *   pnpm ai:cost-audit
 *
 * Reports and alerts; never writes. Exits non-zero when there is something to
 * report and no channel to report it through, so a scheduler shows red instead
 * of a silent success — the whole point of this ticket is that a gap nobody
 * hears about is close to no gap detection at all.
 */

async function main(): Promise<number> {
  const { prisma } = await import('../src/server/prisma.ts');
  const alert = ownerAlert();
  const audit = new PrismaCorrectionCostAudit(prisma, alert);

  try {
    const report = await audit.reportAndAlert();
    if (report.attempts.length === 0) {
      process.stdout.write(
        'Aucune tentative sans coût fournisseur sur 24 h.\n',
      );
      return 0;
    }

    process.stdout.write(
      `${report.attempts.length} tentative(s) sans coût fournisseur entre ${report.since.toISOString()} et ${report.until.toISOString()} :\n${report.attempts
        .map(
          (attempt) =>
            `  ${attempt.kind} · correction ${attempt.correctionId} · tentative ${attempt.attemptId} · fournisseur ${attempt.providerRequestId ?? 'inconnu'}`,
        )
        .join('\n')}\n`,
    );

    if (alert) {
      process.stdout.write('Alerte propriétaire envoyée.\n');
    } else {
      process.stderr.write(
        'ALERT_CHANNEL_NOT_CONFIGURED : rien n’a été envoyé au propriétaire.\n',
      );
    }
    return costAuditExitCode({
      attempts: report.attempts.length,
      hasAlertChannel: Boolean(alert),
    });
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
