import type { CorrectionMonitoringSummary } from './correction-monitoring.js';

/**
 * The weekly correction report, V4.5-142 (quality contract §6).
 *
 * A pure formatter over the monitoring summary and the breaker journal, so what
 * the report says can be tested without a database and cannot drift from what
 * the admin page shows: both read the same numbers.
 */

export interface BreakerJournalEntry {
  action: 'REOPENED' | 'TRIPPED';
  actorEmail: string | null;
  alertError: string | null;
  alertedAt: Date | null;
  createdAt: Date;
  rate: number | null;
  reason: string | null;
}

function ratio(numerator: number, denominator: number): string {
  if (denominator === 0) return 'n/a';
  return `${((numerator / denominator) * 100).toFixed(1)} %`;
}

function rate(value: number | null): string {
  // Never rendered as 0 %: below quorum there is no rate, and printing zero
  // would read as health where the truth is "not enough data".
  return value === null ? 'sous quorum' : `${(value * 100).toFixed(1)} %`;
}

/**
 * Trial→purchase funnel (V4.5-163). Counted, never rated: with a handful of
 * learners a percentage moves twenty points on one purchase and would read as a
 * trend. The rate belongs in the report when the denominator can carry it.
 */
export interface TrialFunnel {
  grantedThisWeek: number;
  purchasedAfterTrial: number;
  suspendedByBreaker: number;
  trialAccounts: number;
}

export function formatWeeklyCorrectionReport(input: {
  funnel?: TrialFunnel;
  journal: BreakerJournalEntry[];
  summary: CorrectionMonitoringSummary;
  week: { since: Date; until: Date };
}): string {
  const { summary } = input;
  const total = summary.corrections.total;
  const lines = [
    `Rapport hebdomadaire correction IA — ${input.week.since.toISOString().slice(0, 10)} → ${input.week.until.toISOString().slice(0, 10)}`,
    '',
    `Coupe-circuit : ${summary.breaker.state}${summary.breaker.reason ? ` (${summary.breaker.reason})` : ''}`,
    `  désaccord vérificateur ${rate(summary.breaker.rates.checkerDisagreement)} · inutilisables ${rate(summary.breaker.rates.unusable)} · contradiction apprenant ${rate(summary.breaker.rates.wrongAtHigh)}`,
  ];
  if (summary.breaker.evaluationError) {
    lines.push(
      `  AVEUGLE : ${summary.breaker.evaluationError} — le garde-fou n'a pas pu se mesurer.`,
    );
  }

  lines.push(
    '',
    `Corrections : ${total} (complètes ${summary.corrections.completed}, partielles ${summary.corrections.partial}, inutilisables ${summary.corrections.unusable} · ${ratio(summary.corrections.unusable, total)})`,
    `Confiance : HIGH ${summary.confidence.high} · MEDIUM ${summary.confidence.medium} · LOW ${summary.confidence.low} · score retiré ${summary.confidence.scoreWithheld}`,
    `Vérificateur : désaccords ${summary.checker.disagreed} · indisponible ${summary.checker.unavailable}`,
    // Kept next to the confidence line on purpose: it is the only figure here
    // that contradicts the system from outside it.
    `Apprenants : « faux » ${summary.learner.wrong} · « utile » ${summary.learner.helpful} · dont « faux » sur un critère HIGH ${summary.learner.wrongAtHigh}`,
    `Coût : total ${summary.cost.totalUsd} USD · P50 ${summary.cost.p50Usd} · P90 ${summary.cost.p90Usd}`,
  );

  if (summary.cost.unknownCostAttempts > 0) {
    lines.push(
      `  ${summary.cost.unknownCostAttempts} tentative(s) sans coût fournisseur — à rapprocher de la facturation.`,
    );
  }

  if (input.funnel) {
    lines.push(
      '',
      `Essai : ${input.funnel.trialAccounts} compte(s) en cohorte essai · ${input.funnel.grantedThisWeek} allocation(s) cette semaine · ${input.funnel.purchasedAfterTrial} achat(s) après essai`,
    );
    if (input.funnel.suspendedByBreaker > 0) {
      // Not a funnel loss: these learners were refused a grant because the
      // feature was suspended, which is our doing and not their choice.
      lines.push(
        `  ${input.funnel.suspendedByBreaker} allocation(s) non versée(s) — coupe-circuit ouvert.`,
      );
    }
  }

  lines.push('', 'Journal du coupe-circuit :');
  if (input.journal.length === 0) {
    lines.push('  aucun événement.');
  } else {
    for (const entry of input.journal) {
      const stamp = entry.createdAt.toISOString();
      if (entry.action === 'TRIPPED') {
        // Whether the owner was actually told is part of the record, not an
        // assumption: an alert lost in silence is the failure this reporting
        // exists to catch.
        const delivery = entry.alertedAt
          ? `alerte envoyée ${entry.alertedAt.toISOString()}`
          : `ALERTE NON REMISE${entry.alertError ? ` (${entry.alertError})` : ''}`;
        lines.push(
          `  ${stamp} déclenché — ${entry.reason ?? 'cause inconnue'} à ${rate(entry.rate)} · ${delivery}`,
        );
      } else {
        lines.push(
          `  ${stamp} rouvert par ${entry.actorEmail ?? 'compte supprimé'}`,
        );
      }
    }
  }

  return lines.join('\n');
}
