/**
 * `REPORT.md` generator for a regression run (V4.5-120, spec §7).
 *
 * The report is what a reviewer reads instead of the raw artefacts, so it is
 * written to be hard to misread: every rate carries its counts, every gate says
 * which budget it was measured against, and an unmeasured gate is printed as
 * unmeasured rather than omitted. A gate that silently disappears from a report
 * is indistinguishable from a gate that passed.
 *
 * It contains no learner text and no full model output: §7 keeps raw responses
 * out of Git, and a "top unstable cases" table needs identifiers, not prose.
 */

import type {
  RegressionGateEvaluation,
  RegressionGateResult,
} from './ai-correction-regression-gates.js';
import type { RegressionMetrics, RegressionRate } from './ai-correction-regression-metrics.js';

/** Cost and latency figures the runner already computes. */
export type RegressionRunCosts = {
  actualCostUsd: number | null;
  estimatedCostUsd: number;
  p50CostUsdPerCorrection: number | null;
  p90CostUsdPerCorrection: number | null;
  p50LatencyMs: number | null;
  p90LatencyMs: number | null;
};

export type RegressionRunIdentity = {
  checkerIdentity: string;
  generatorVersion: string;
  gatePolicyVersion: string;
  /** Seed of the held-out mutant set, and where it came from. */
  heldOutSeed: string;
  heldOutSeedSource: 'DERIVED' | 'OVERRIDE';
  poolId: string;
  poolSha256: string;
  primaryIdentity: string;
  profile: string;
  repetitions: number;
  runStartedAt: string;
};

export type RegressionConfidenceDistribution = {
  high: number;
  low: number;
  medium: number;
};

export function renderRegressionReport(input: {
  confidence: RegressionConfidenceDistribution;
  costs: RegressionRunCosts;
  evaluation: RegressionGateEvaluation;
  identity: RegressionRunIdentity;
  metrics: RegressionMetrics;
  /** Counts of what was actually executed, per mutant kind. */
  mutantCounts: Record<string, number>;
}): string {
  const lines: string[] = [];

  lines.push(`# Run de régression — ${input.identity.poolId}`);
  lines.push('');
  lines.push(
    input.evaluation.promotionEligible
      ? '**Promotion : éligible.** Tous les gates bloquants sont verts.'
      : '**Promotion : refusée.** Au moins un gate bloquant est rouge ou non mesuré.',
  );
  lines.push('');
  lines.push(
    "Ce rapport mesure la cohérence, la stabilité, la sûreté et la calibration du système sur des propriétés décidables. Il ne prouve pas la justesse pédagogique d'un niveau (spec §8).",
  );
  lines.push('');

  lines.push('## Identité du run');
  lines.push('');
  lines.push('| Élément | Valeur |');
  lines.push('| --- | --- |');
  lines.push(`| Démarré le | ${input.identity.runStartedAt} |`);
  lines.push(`| Profil | ${input.identity.profile} |`);
  lines.push(`| Répétitions | ${input.identity.repetitions} |`);
  lines.push(`| Pool | \`${input.identity.poolId}\` |`);
  lines.push(`| Empreinte du pool | \`${input.identity.poolSha256}\` |`);
  lines.push(
    `| Générateur de mutants | \`${input.identity.generatorVersion}\` |`,
  );
  lines.push(
    `| Politique de gate | \`${input.identity.gatePolicyVersion}\` |`,
  );
  lines.push(`| Identité primaire | \`${input.identity.primaryIdentity}\` |`);
  lines.push(`| Vérificateur | \`${input.identity.checkerIdentity}\` |`);
  lines.push(
    `| Graine du jeu tenu à l'écart | \`${input.identity.heldOutSeed}\` (${input.identity.heldOutSeedSource}) |`,
  );
  lines.push('');
  lines.push(
    "La reproductibilité d'un mutant tient à l'empreinte du pool et à la version du générateur ci-dessus ; les textes mutés ne sont pas commités.",
  );
  lines.push('');

  lines.push('## Gates');
  lines.push('');
  lines.push('| Gate | Type | Mesure | Budget | Statut |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const gate of input.evaluation.gates) {
    lines.push(
      `| ${gate.key} | ${translateKind(gate.kind)} | ${formatMeasure(gate)} | ${formatBudget(gate)} | ${translateStatus(gate.status)} |`,
    );
  }
  lines.push('');

  if (input.evaluation.policyErrors.length > 0) {
    lines.push('### Erreurs de politique');
    lines.push('');
    lines.push(
      'Un seuil plus fin que la résolution de l\'échantillon est refusé : il faut le déclarer comme budget entier explicite.',
    );
    lines.push('');
    for (const error of input.evaluation.policyErrors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  if (input.evaluation.gateFailures.length > 0) {
    lines.push('### Gates bloquants en échec');
    lines.push('');
    for (const failure of input.evaluation.gateFailures) {
      lines.push(`- ${failure}`);
    }
    lines.push('');
    lines.push(
      "Aucun retuning sur ce run ne transforme un rouge en vert : la politique est figée avant l'exécution (contrat §5).",
    );
    lines.push('');
  }

  lines.push('## Mutants exécutés');
  lines.push('');
  lines.push('| Type | Exécutés |');
  lines.push('| --- | --- |');
  for (const [kind, count] of Object.entries(input.mutantCounts).sort()) {
    lines.push(`| ${kind} | ${count} |`);
  }
  lines.push('');
  const emptyKinds = Object.entries(input.mutantCounts)
    .filter(([, count]) => count === 0)
    .map(([kind]) => kind);
  if (emptyKinds.length > 0) {
    lines.push(
      `Aucun mutant produit pour : ${emptyKinds.join(', ')}. Ces oracles ne contribuent à aucune métrique de ce run ; leur dénominateur est nul et non « parfait ».`,
    );
    lines.push('');
  }

  lines.push('## Métriques');
  lines.push('');
  lines.push('| Métrique | Numérateur | Dénominateur | Taux |');
  lines.push('| --- | --- | --- | --- |');
  for (const [name, value] of metricRows(input.metrics)) {
    lines.push(
      `| ${name} | ${value.numerator} | ${value.denominator} | ${formatRate(value)} |`,
    );
  }
  lines.push('');

  lines.push('## Distribution des confiances');
  lines.push('');
  const total =
    input.confidence.high + input.confidence.medium + input.confidence.low;
  lines.push('| Niveau | Critères | Part |');
  lines.push('| --- | --- | --- |');
  for (const [label, count] of [
    ['HIGH', input.confidence.high],
    ['MEDIUM', input.confidence.medium],
    ['LOW', input.confidence.low],
  ] as const) {
    lines.push(
      `| ${label} | ${count} | ${total === 0 ? 'non mesuré' : formatPercent(count / total)} |`,
    );
  }
  lines.push('');

  lines.push('## Coûts et latences');
  lines.push('');
  lines.push('| Mesure | Valeur |');
  lines.push('| --- | --- |');
  lines.push(`| Coût estimé | ${formatUsd(input.costs.estimatedCostUsd)} |`);
  lines.push(
    `| Coût réconcilié fournisseur | ${formatUsd(input.costs.actualCostUsd)} |`,
  );
  lines.push(
    `| Coût P50 par correction | ${formatUsd(input.costs.p50CostUsdPerCorrection)} |`,
  );
  lines.push(
    `| Coût P90 par correction | ${formatUsd(input.costs.p90CostUsdPerCorrection)} |`,
  );
  lines.push(`| Latence P50 | ${formatMs(input.costs.p50LatencyMs)} |`);
  lines.push(`| Latence P90 | ${formatMs(input.costs.p90LatencyMs)} |`);
  lines.push('');

  lines.push('## Dix cas les moins stables');
  lines.push('');
  if (input.metrics.leastStableCases.length === 0) {
    lines.push('Aucun critère n\'a bougé entre les répétitions.');
  } else {
    lines.push('| Cas | Critère | Écart maximal (pas) |');
    lines.push('| --- | --- | --- |');
    for (const entry of input.metrics.leastStableCases) {
      lines.push(
        `| \`${entry.caseId}\` | ${entry.criterionKey} | ${entry.maximumStepSpread} |`,
      );
    }
  }
  lines.push('');

  if (input.metrics.mutationDirectionViolationDetails.length > 0) {
    lines.push('## Violations de direction de mutation');
    lines.push('');
    lines.push('| Mutant | Critère | Niveau observé | Motif |');
    lines.push('| --- | --- | --- | --- |');
    for (const violation of input.metrics.mutationDirectionViolationDetails) {
      lines.push(
        `| \`${violation.mutantId}\` | ${violation.criterionKey} | ${violation.observedLevelKey || '—'} | ${violation.reason} |`,
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function metricRows(
  metrics: RegressionMetrics,
): [string, RegressionRate][] {
  return [
    ['mutationDirectionViolations', metrics.mutationDirectionViolations],
    ['unrelatedCriterionDrift', metrics.unrelatedCriterionDrift],
    ['repetitionTwoStepFlips', metrics.repetitionTwoStepFlips],
    ['repetitionTwoStepFlipsAtHigh', metrics.repetitionTwoStepFlipsAtHigh],
    ['checkerAgreementAtHigh', metrics.checkerAgreementAtHigh],
    ['checkerFalseAgreeRate', metrics.checkerFalseAgreeRate],
    ['lowShare', metrics.lowShare],
    [
      'injectionAppendQuotedInAcceptedOutput',
      metrics.injectionAppendQuotedInAcceptedOutput,
    ],
    ['modelAuthoredAgreement', metrics.modelAuthoredAgreement],
  ];
}

function formatMeasure(gate: RegressionGateResult): string {
  return gate.denominator === 0
    ? 'non mesuré'
    : `${gate.numerator}/${gate.denominator} (${formatRate({
        denominator: gate.denominator,
        numerator: gate.numerator,
        rate: gate.observedRate,
      })})`;
}

function formatBudget(gate: RegressionGateResult): string {
  if (gate.kind === 'REPORTED') return 'aucun';
  if (gate.budget === null) return '—';
  return gate.kind === 'BLOCKING' || gate.kind === 'WATCHED'
    ? `${gate.budget}`
    : '—';
}

function translateKind(kind: RegressionGateResult['kind']): string {
  if (kind === 'BLOCKING') return 'bloquant';
  if (kind === 'WATCHED') return 'surveillé';
  return 'rapporté';
}

function translateStatus(status: RegressionGateResult['status']): string {
  if (status === 'PASS') return 'vert';
  if (status === 'FAIL') return '**rouge**';
  if (status === 'NOT_MEASURED') return '**non mesuré**';
  return 'rapporté';
}

function formatRate(value: RegressionRate): string {
  return value.rate === null ? 'non mesuré' : formatPercent(value.rate);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)} %`;
}

function formatUsd(value: number | null): string {
  return value === null ? 'non réconcilié' : `${value.toFixed(4)} USD`;
}

function formatMs(value: number | null): string {
  return value === null ? 'non mesuré' : `${Math.round(value)} ms`;
}
