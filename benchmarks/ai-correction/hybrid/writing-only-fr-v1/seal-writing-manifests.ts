import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCorrectionBenchmarkCorpus } from '../../../../src/lib/ai-correction-benchmark.ts';
import { correctionBenchmarkConfigurationSha256 } from '../../../../scripts/generate-ai-correction-full-blind-review.ts';
import {
  mergeAutonomousHoldoutBenchmarkConfiguration,
  parseAutonomousHoldoutConfiguration,
} from '../../../../scripts/run-ai-correction-benchmark.ts';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sealedAt = '2026-08-24T13:55:00Z';

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readText(name: string): Promise<string> {
  return readFile(path.join(directory, name), 'utf8');
}

async function readJson(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readText(name)) as Record<string, unknown>;
}

async function writeJson(name: string, value: unknown): Promise<string> {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path.join(directory, name), serialized, 'utf8');
  return sha256(serialized);
}

const corpusRaw = await readText('corpus.sealed.json');
const corpus = parseCorrectionBenchmarkCorpus(JSON.parse(corpusRaw) as unknown);
if (
  corpus.cases.length !== 24 ||
  corpus.contracts.some(
    (contract) => contract.target.activityType !== 'writing',
  ) ||
  corpus.humanReview.status !== 'PENDING'
) {
  throw new Error('WRITING_SEALED_CORPUS_INVARIANT_FAILED');
}
const corpusSha256 = sha256(corpusRaw);

const sourcePaths = [
  'PRE_REGISTRATION.md',
  'authoring-plan.preregistered.json',
  'criterion-semantics.preregistered.json',
  'author-proposals.freeze.json',
  'cross-label-reviews.freeze.json',
  'cross-label-comparison.corrected.json',
  'compile-writing-corpus.mjs',
];
const sourceArtifacts = await Promise.all(
  sourcePaths.map(async (sourcePath) => ({
    path: sourcePath,
    sha256: sha256(await readText(sourcePath)),
  })),
);
const authoringManifestSha256 = await writeJson('manifest.final.json', {
  schemaVersion: 1,
  artifactKind: 'AUTHORING_PROVENANCE_MANIFEST',
  manifestId: 'learnx-french-writing-holdout-v1-final',
  status: 'FINAL',
  finalizedAt: sealedAt,
  corpusPath: 'corpus.sealed.json',
  corpusSha256,
  sourceArtifacts,
  authoringChecks: {
    status: 'PASS',
    caseCount: 24,
    criterionGoldCount: 72,
    repetitions: 3,
    candidateOutputsConsulted: false,
    networkOrModelCallsMade: false,
    allContractsWriting: true,
  },
  humanReview: {
    status: 'PENDING',
    humanReviewApproved: false,
  },
  notice:
    'The final REJECTED review remains the last editorial review. Exact owner-authorized mechanical resolutions are recorded separately and are not presented as a new review.',
});

const budgetAuthorizationPath = 'OWNER_CONTINGENCY_2026-08-24_4USD.json';
const budgetAuthorizationSha256 = sha256(
  await readText(budgetAuthorizationPath),
);
const ownerAuthorizationSha256 = await writeJson(
  'owner-authorization.final.json',
  {
    schemaVersion: 1,
    artifactKind: 'OWNER_AUTONOMOUS_REVIEW_AUTHORIZATION',
    status: 'APPROVED',
    authorizedAt: sealedAt,
    authorizationSource: 'DIRECT_USER_MESSAGE_IN_ACTIVE_CODEX_THREAD',
    authorizationText:
      'J’autorise les trois fallbacks convergents et les deux corrections individuelles de gold après la revue REJECTED, puis le scellement et l’exécution unique de l’examen Writing sous le plafond absolu de 4 USD, sans nouvelle revue ni changement de seuil.',
    reviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
    humanReviewApprovedMustRemainFalse: true,
    supplierBudgetMaximumUsd: 4,
    operationalSupplierCapUsd: 4,
    budgetAuthorization: {
      path: budgetAuthorizationPath,
      sha256: budgetAuthorizationSha256,
    },
    scope: {
      benchmarkId: 'learnx-french-writing-correction-sonnet-v3-1-guarded-v1',
      corpusId: 'learnx-french-writing-holdout-v1',
      candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
      modelId: 'anthropic/claude-sonnet-4.6',
      provider: 'Anthropic',
      activityType: 'writing',
      semanticCases: 24,
      repetitions: 3,
      transportRetries: 0,
    },
  },
);

const budgetPolicyPath =
  'PREREGISTRATION_AMENDMENT_2026-08-24_OWNER_CONTINGENCY_4USD.md';
const budgetPolicySha256 = sha256(await readText(budgetPolicyPath));
const overlay = parseAutonomousHoldoutConfiguration({
  ...(await readJson('configuration.preregistered.json')),
  budgetPolicyPath,
  budgetPolicySha256,
  candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
  corpusReviewManifestPath: 'corpus-resolution.authorized.json',
  supplierCostCapUsd: 4,
});
const configuration = mergeAutonomousHoldoutBenchmarkConfiguration({
  baseConfiguration: await readJson(overlay.extends),
  overlay,
});
const configurationSha256 = correctionBenchmarkConfigurationSha256({
  budgetPolicySha256,
  candidateId: overlay.candidateId,
  configuration,
  supplierCostCapUsd: 4,
});
await writeJson('configuration.contingency-4usd.json', overlay);

const priorRejectedReviewPath =
  'corpus-review.preseal-v2.autonomous.json';
const priorRejectedDecisionPath = 'preseal-decision.final.json';
const resolutionSha256 = await writeJson(
  'corpus-resolution.authorized.json',
  {
    schemaVersion: 1,
    artifactKind: 'WRITING_CORPUS_PRESEAL_RESOLUTION',
    status: 'AUTHORIZED_MECHANICAL_CLOSURE',
    benchmarkId: overlay.benchmarkId,
    corpusId: overlay.corpusId,
    corpusSha256,
    configurationSha256,
    authoringManifestSha256,
    ownerAuthorizationReference: 'owner-authorization.final.json',
    ownerAuthorizationSha256,
    priorRejectedDecisionPath,
    priorRejectedDecisionSha256: sha256(
      await readText(priorRejectedDecisionPath),
    ),
    priorRejectedReviewPath,
    priorRejectedReviewSha256: sha256(
      await readText(priorRejectedReviewPath),
    ),
    fallbacks: [
      {
        cellId: 'writing-v1-reflective-note-complete-concise',
        selectedCaseId: 'author-a-reflective-note-complete-concise',
      },
      {
        cellId: 'writing-v1-reflective-note-erroneous-decidable',
        selectedCaseId: 'author-a-reflective-note-erroneous-decidable',
      },
      {
        cellId: 'writing-v1-reflective-note-prompt-injection',
        selectedCaseId: 'author-a-reflective-note-prompt-injection',
      },
    ],
    individualGoldCorrections: [
      {
        cellId: 'writing-v1-explanatory-analysis-erroneous-decidable',
        criterionKey: 'source-fidelity',
        from: 'limited',
        to: 'partial',
      },
      {
        cellId: 'writing-v1-reflective-note-erroneous-decidable',
        criterionKey: 'event-sequence-grounding',
        from: 'limited',
        to: 'partial',
      },
    ],
    resolutionScope: {
      activityType: 'writing',
      fallbackCount: 3,
      individualGoldCorrectionCount: 2,
      additionalEditorialReviewPerformed: false,
      thresholdsChanged: false,
    },
    resolvedAt: sealedAt,
  },
);

console.log(
  JSON.stringify(
    {
      authoringManifestSha256,
      configurationSha256,
      corpusSha256,
      ownerAuthorizationSha256,
      resolutionSha256,
    },
    null,
    2,
  ),
);
