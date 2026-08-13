import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parseCorrectionBenchmarkCorpus } from '../src/lib/ai-correction-benchmark.ts';
import {
  assertFrozenCompositeRunEnvelope,
  createCompositeRunEnvelopeFingerprint,
  type CompositeRunEnvelope,
} from '../src/server/ai/composite-pipeline-validation.ts';

const MINI_STATE = resolve(
  'benchmarks/ai-correction/results/composite/v4-009b-mini-panel-2026-08-13/state.json',
);
const MINI_LEDGER = resolve(
  'benchmarks/ai-correction/results/composite/v4-009b-mini-panel-2026-08-13/budget-ledger.jsonl',
);
const MINI_ENVELOPE = resolve(
  'benchmarks/ai-correction/composite/v4-009b-run-envelope.json',
);
const CORPUS = resolve('benchmarks/ai-correction/corpus.v1.json');
const CONFIGURATION = resolve('benchmarks/ai-correction/benchmark.v1.json');
const OUTPUT = resolve(
  'benchmarks/ai-correction/composite/v4-009b-diagnostic-extension.json',
);

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

const [
  rawCorpusBytes,
  configurationBytes,
  miniEnvelopeBytes,
  miniStateBytes,
  miniLedgerBytes,
] = await Promise.all([
  readFile(CORPUS),
  readFile(CONFIGURATION),
  readFile(MINI_ENVELOPE),
  readFile(MINI_STATE),
  readFile(MINI_LEDGER),
]);
const rawCorpus = JSON.parse(rawCorpusBytes.toString('utf8')) as {
  cases: Array<{ caseId: string }>;
};
const corpus = parseCorrectionBenchmarkCorpus(rawCorpus);
const miniEnvelope = JSON.parse(
  miniEnvelopeBytes.toString('utf8'),
) as CompositeRunEnvelope & Record<string, unknown>;
const miniState = JSON.parse(miniStateBytes.toString('utf8')) as {
  attempts: Array<{ usage?: { actualCostUsd?: number } }>;
  cells: unknown[];
  envelopeFingerprint: string;
};
const usageCostUsd = miniState.attempts.reduce(
  (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
  0,
);
if (
  miniState.cells.length !== 12 ||
  miniState.attempts.length !== 20 ||
  usageCostUsd !== 0.2018835 ||
  miniState.envelopeFingerprint !==
    createCompositeRunEnvelopeFingerprint(miniEnvelope)
) {
  throw new Error('DIAGNOSTIC_SOURCE_MINI_PANEL_MISMATCH');
}

const cells = rawCorpus.cases.flatMap((benchmarkCase) =>
  ([1, 2, 3] as const).map((repetition) => ({
    caseDigest: sha256(JSON.stringify(benchmarkCase)),
    caseId: benchmarkCase.caseId,
    repetition,
  })),
);
const envelope = {
  authorization: 'OWNER_GO_REQUIRED',
  budget: {
    absoluteCampaignMaximumProviderCalls: 180,
    currency: 'USD_PROVIDER_USAGE_COST',
    expectedWithoutRetryUsd: 1.3,
    maximumInitialVerifierCalls: 68,
    maximumProviderCalls: 180,
    maximumTechnicalRetriesPerRoleAndCell: 1,
    maximumUsageCostUsd: 2,
    preflightFormula:
      'actualCostUsd + reservedInFlightUsd + worstCaseNextUsd <= 2.00',
    rateCardSnapshot: miniEnvelope.budget.rateCardSnapshot,
    status: 'ARBITRATED',
  },
  campaignKind: 'DIAGNOSTIC_FULL',
  cells,
  corpusId: corpus.corpusId,
  corpusSha256: sha256(rawCorpusBytes),
  diagnosticExtension: {
    completedLogicalWorkflows: 12,
    maximumAdditionalProviderCalls: 160,
    missingPrimaryCells: 60,
    remainingUsageCostUsd: 2 - usageCostUsd,
    reviewScope:
      'DIAGNOSTIC_NON_PROMOTIONAL_NO_RETROACTIVE_MINI_PANEL_REQUALIFICATION',
  },
  diagnosticReuse: {
    completedCellCount: 12,
    completedProviderAttempts: 20,
    miniPanelEnvelopeFingerprint: miniState.envelopeFingerprint,
    miniPanelLedgerSha256: sha256(miniLedgerBytes),
    miniPanelStateSha256: sha256(miniStateBytes),
    usageCostUsd,
  },
  holdoutStatus: 'CLOSED',
  identity: {
    ...(miniEnvelope.identity as object),
    benchmarkConfigurationSha256: sha256(configurationBytes),
  },
  panelVersion: 'diagnostic-1.0.0',
  priorMiniPanelVerdict: {
    immutable: true,
    status: 'NO_GO',
  },
  repetitions: 3,
  schemaVersion: 1,
  status: 'FROZEN',
} satisfies CompositeRunEnvelope & Record<string, unknown>;
assertFrozenCompositeRunEnvelope(envelope);

const content = `${JSON.stringify(envelope, null, 2)}\n`;
await writeFile(OUTPUT, content, 'utf8');
await writeFile(
  `${OUTPUT}.sha256`,
  `${sha256(content)}  v4-009b-diagnostic-extension.json\n\n# Canonical envelope fingerprint\n${createCompositeRunEnvelopeFingerprint(envelope)}\n`,
  'utf8',
);
console.log(
  JSON.stringify(
    {
      authorization: envelope.authorization,
      cells: envelope.cells.length,
      completedCells: 12,
      maximumAdditionalProviderCalls: 160,
      remainingPrimaryCells: 60,
      remainingUsageCostUsd: 2 - usageCostUsd,
      status: 'READY_FOR_OWNER_GO_AFTER_OFFLINE_VALIDATION',
    },
    null,
    2,
  ),
);
