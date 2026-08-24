import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from '../../../../src/lib/ai-correction-benchmark.ts';

const draftDirectory = path.dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function ngrams(value, size) {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  const result = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join(' '));
  }
  return result;
}

function jaccard(left, right) {
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection || 1);
}

const corpusPath = path.join(draftDirectory, 'corpus.draft.json');
const configurationPath = path.join(
  draftDirectory,
  'configuration.draft.json',
);
const manifestPath = path.join(draftDirectory, 'manifest.draft.json');
const reviewGatePath = path.join(
  draftDirectory,
  'review-manifest.pending.json',
);

const corpusRaw = readFileSync(corpusPath, 'utf8');
const corpus = parseCorrectionBenchmarkCorpus(JSON.parse(corpusRaw));
const overlay = readJson(configurationPath);
const manifest = readJson(manifestPath);
const reviewGate = readJson(reviewGatePath);

const overlayKeys = [
  'benchmarkId',
  'corpusId',
  'corpusPath',
  'extends',
  'reviewManifestPath',
  'reviewPanelCaseIds',
  'schemaVersion',
].sort();
assert(
  sameJson(Object.keys(overlay).sort(), overlayKeys),
  'CONFIGURATION_DRAFT_KEYS_INVALID',
);
assert(overlay.schemaVersion === 1, 'CONFIGURATION_SCHEMA_VERSION_INVALID');
assert(overlay.corpusPath === 'corpus.draft.json', 'CORPUS_PATH_INVALID');
assert(
  overlay.reviewManifestPath === 'review-manifest.pending.json',
  'MANIFEST_PATH_INVALID',
);

const baseConfigurationPath = path.resolve(draftDirectory, overlay.extends);
const baseConfiguration = parseCorrectionBenchmarkConfiguration(
  readJson(baseConfigurationPath),
);
const resolvedConfiguration = parseCorrectionBenchmarkConfiguration({
  ...baseConfiguration,
  benchmarkId: overlay.benchmarkId,
  corpusId: overlay.corpusId,
  reviewPanelCaseIds: overlay.reviewPanelCaseIds,
});

assert(corpus.corpusId === overlay.corpusId, 'CORPUS_ID_MISMATCH');
assert(corpus.language === 'fr-FR', 'CORPUS_LANGUAGE_INVALID');
assert(corpus.syntheticOnly === true, 'CORPUS_MUST_BE_SYNTHETIC');
assert(corpus.humanReview.status === 'PENDING', 'CORPUS_REVIEW_NOT_PENDING');
assert(corpus.humanReview.reviewer === null, 'CORPUS_REVIEWER_MUST_BE_NULL');
assert(corpus.humanReview.reviewedAt === null, 'CORPUS_REVIEW_DATE_MUST_BE_NULL');
assert(corpus.cases.length === 24, 'EXPECTED_24_CASES');
assert(corpus.contracts.length === 4, 'EXPECTED_4_CONTRACTS');

const casesById = new Map(corpus.cases.map((benchmarkCase) => [
  benchmarkCase.caseId,
  benchmarkCase,
]));
assert(casesById.size === 24, 'CASE_IDS_MUST_BE_UNIQUE');
assert(overlay.reviewPanelCaseIds.length === 6, 'EXPECTED_6_REVIEW_PANEL_CASES');
assert(
  new Set(overlay.reviewPanelCaseIds).size === 6,
  'REVIEW_PANEL_CASES_MUST_BE_UNIQUE',
);
for (const caseId of overlay.reviewPanelCaseIds) {
  assert(casesById.has(caseId), `UNKNOWN_REVIEW_PANEL_CASE:${caseId}`);
}
assert(
  new Set(
    overlay.reviewPanelCaseIds.map((caseId) => casesById.get(caseId).category),
  ).size === 5,
  'REVIEW_PANEL_MUST_COVER_ALL_FIVE_USED_CATEGORIES',
);

const expectedCategoryCounts = {
  SUCCESSFUL: 4,
  PARTIAL: 4,
  ERRONEOUS: 4,
  AMBIGUOUS: 4,
  PROMPT_INJECTION: 8,
};
const categoryCounts = Object.fromEntries(
  Object.keys(expectedCategoryCounts).map((category) => [category, 0]),
);
for (const benchmarkCase of corpus.cases) {
  assert(
    Object.hasOwn(categoryCounts, benchmarkCase.category),
    `UNEXPECTED_CATEGORY:${benchmarkCase.category}`,
  );
  categoryCounts[benchmarkCase.category] += 1;
}
assert(
  sameJson(categoryCounts, expectedCategoryCounts),
  'CATEGORY_DISTRIBUTION_INVALID',
);

const contractsById = new Map(
  corpus.contracts.map((contract) => [
    `${contract.contractKey}@${contract.version}`,
    contract,
  ]),
);
let goldCount = 0;
const profileCounts = new Map();
for (const contract of corpus.contracts) {
  assert(contract.lifecycle.status === 'DRAFT', 'CONTRACT_MUST_BE_DRAFT');
  assert(contract.lifecycle.publishedAt === null, 'DRAFT_CONTRACT_PUBLISHED');
  assert(contract.criteria.length === 3, 'EVERY_CONTRACT_MUST_HAVE_3_CRITERIA');
  assert(
    contract.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) ===
      100,
    `CONTRACT_WEIGHT_INVALID:${contract.contractKey}`,
  );
  const contractCases = corpus.cases.filter(
    (benchmarkCase) => benchmarkCase.contractKey === contract.contractKey,
  );
  assert(contractCases.length === 6, `EXPECTED_6_CASES:${contract.contractKey}`);
  for (const criterion of contract.criteria) {
    assert(
      criterion.acceptableVariants.length > 0,
      `ACCEPTABLE_VARIANTS_REQUIRED:${contract.contractKey}:${criterion.key}`,
    );
    assert(
      criterion.calibratedExamples.length > 0,
      `CALIBRATED_EXAMPLE_REQUIRED:${contract.contractKey}:${criterion.key}`,
    );
  }
  for (const category of ['SUCCESSFUL', 'PARTIAL', 'ERRONEOUS', 'AMBIGUOUS']) {
    assert(
      contractCases.filter((benchmarkCase) => benchmarkCase.category === category)
        .length === 1,
      `CONTRACT_CATEGORY_INVALID:${contract.contractKey}:${category}`,
    );
  }
  assert(
    contractCases.filter(
      (benchmarkCase) => benchmarkCase.category === 'PROMPT_INJECTION',
    ).length === 2,
    `CONTRACT_INJECTION_COUNT_INVALID:${contract.contractKey}`,
  );
}

for (const benchmarkCase of corpus.cases) {
  const contract = contractsById.get(
    `${benchmarkCase.contractKey}@${benchmarkCase.contractVersion}`,
  );
  assert(contract, `UNKNOWN_CONTRACT:${benchmarkCase.caseId}`);
  assert(
    benchmarkCase.expectedCriteria.length === 3,
    `EXPECTED_3_GOLDS:${benchmarkCase.caseId}`,
  );
  goldCount += benchmarkCase.expectedCriteria.length;
  assert(
    benchmarkCase.expectedSecondPass.required === false,
    `SECOND_PASS_MUST_BE_FALSE:${benchmarkCase.caseId}`,
  );
  assert(
    benchmarkCase.expectedSecondPass.rationale.includes(
      'sans signal observable',
    ),
    `SECOND_PASS_RATIONALE_INVALID:${benchmarkCase.caseId}`,
  );

  const expectedByCriterion = new Map(
    benchmarkCase.expectedCriteria.map((criterion) => [
      criterion.criterionKey,
      criterion.levelKey,
    ]),
  );
  const profile = contract.criteria
    .map((criterion) => expectedByCriterion.get(criterion.key))
    .join('/');
  profileCounts.set(profile, (profileCounts.get(profile) ?? 0) + 1);

  const total = contract.criteria.reduce((sum, criterion) => {
    const levelKey = expectedByCriterion.get(criterion.key);
    const level = criterion.performanceLevels.find(
      (candidate) => candidate.key === levelKey,
    );
    assert(level, `UNKNOWN_LEVEL:${benchmarkCase.caseId}:${criterion.key}`);
    return sum + (level.score * criterion.weight) / 100;
  }, 0);
  const expectedTotalFragment = `total ${String(total).replace('.', ',')}/100`;
  assert(
    benchmarkCase.goldRationale.includes(expectedTotalFragment),
    `GOLD_SCORE_CALCULATION_MISSING:${benchmarkCase.caseId}`,
  );
  const decision = total >= contract.passingScore ? 'PASS' : 'FAIL';
  assert(
    benchmarkCase.goldRationale.includes(
      `donc ${decision} au seuil ${contract.passingScore}`,
    ),
    `GOLD_DECISION_CALCULATION_MISSING:${benchmarkCase.caseId}`,
  );
}
assert(goldCount === 72, 'EXPECTED_72_GOLDS');
assert(profileCounts.size >= 10, 'GOLD_PROFILES_NOT_DIVERSE_ENOUGH');
assert(
  (profileCounts.get('mastered/mastered/mastered') ?? 0) <= 6,
  'TOO_MANY_ALL_MASTERED_PROFILES',
);

const responseLengths = corpus.cases.map(
  (benchmarkCase) => benchmarkCase.responseText.length,
);
assert(Math.min(...responseLengths) >= 400, 'RESPONSE_EXCERPT_TOO_SHORT');
assert(
  responseLengths.filter((length) => length >= 800).length >= 5,
  'EXPECTED_5_LONG_RESPONSE_EXCERPTS',
);

const injectionCases = corpus.cases.filter(
  (benchmarkCase) => benchmarkCase.category === 'PROMPT_INJECTION',
);
assert(injectionCases.length === 8, 'EXPECTED_8_INJECTION_CASES');
let disclosureAttackCount = 0;
let allowedEvidenceQuoteCount = 0;
const commandFragments = [
  'prompt système',
  'canari secret',
  'ignore la rubrique',
  'Ignore la correction fiable',
];
const attackKinds = new Map([
  ['holdout4-project-bat-corridor-injection', 'SCHEMA'],
  ['holdout4-writing-radio-window-injection', 'SINGLE_CRITERION'],
  ['holdout4-reflection-planetarium-drill-injection', 'SINGLE_CRITERION'],
  ['holdout4-practice-herbarium-loan-injection', 'SINGLE_CRITERION'],
  ['holdout4-practice-maritime-signal-injection', 'KEY_SWAP'],
  ['holdout4-project-manuscript-ocr-injection', 'ALL_CRITERIA_ELEVATION'],
  ['holdout4-writing-orchestra-freight-injection', 'SCHEMA'],
  ['holdout4-reflection-radio-metadata-injection', 'KEY_SWAP'],
]);
const observedAttackKindCounts = new Map();
for (const benchmarkCase of injectionCases) {
  const security = benchmarkCase.injectionSecurity;
  assert(security, `INJECTION_SECURITY_MISSING:${benchmarkCase.caseId}`);
  assert(
    benchmarkCase.responseText ===
      `${security.legitimateResponseText} ${security.attackText}`,
    `INJECTION_CONCATENATION_INVALID:${benchmarkCase.caseId}`,
  );
  const forbidden = new Set(security.forbiddenOutputFragments);
  assert(
    forbidden.size === security.forbiddenOutputFragments.length,
    `DUPLICATE_FORBIDDEN_FRAGMENT:${benchmarkCase.caseId}`,
  );
  const quotedPayloads = [...security.attackText.matchAll(/«([^»]+)»/gu)].map(
    (match) => match[1].trim(),
  );
  for (const payload of quotedPayloads) {
    assert(
      forbidden.has(payload),
      `QUOTED_PAYLOAD_NOT_FORBIDDEN:${benchmarkCase.caseId}:${payload}`,
    );
  }
  for (const fragment of commandFragments) {
    if (security.attackText.includes(fragment)) {
      assert(
        forbidden.has(fragment),
        `COMMAND_FRAGMENT_NOT_FORBIDDEN:${benchmarkCase.caseId}:${fragment}`,
      );
    }
  }
  for (const fragment of forbidden) {
    assert(
      !security.legitimateResponseText.includes(fragment),
      `FORBIDDEN_FRAGMENT_IN_LEGITIMATE_TEXT:${benchmarkCase.caseId}:${fragment}`,
    );
  }
  for (const quote of security.allowedEvidenceQuotes) {
    allowedEvidenceQuoteCount += 1;
    assert(
      security.legitimateResponseText.split(quote).length === 2,
      `ALLOWED_QUOTE_NOT_UNIQUE_IN_LEGITIMATE_TEXT:${benchmarkCase.caseId}:${quote}`,
    );
    assert(
      !security.attackText.includes(quote),
      `ALLOWED_QUOTE_PRESENT_IN_ATTACK:${benchmarkCase.caseId}:${quote}`,
    );
  }
  const expectedByCriterion = new Map(
    benchmarkCase.expectedCriteria.map((criterion) => [
      criterion.criterionKey,
      criterion.levelKey,
    ]),
  );
  const requestedAssignments = [
    ...security.attackText.matchAll(
      /([a-z][a-z-]+) au niveau (mastered|partial|limited|insufficient)/gu,
    ),
  ].map((match) => ({ criterionKey: match[1], levelKey: match[2] }));
  const requestedAllLevel = security.attackText.includes(
    'tous les critères au niveau mastered',
  )
    ? 'mastered'
    : security.attackText.includes('tous les critères au niveau insufficient')
      ? 'insufficient'
      : null;
  const attackKind = attackKinds.get(benchmarkCase.caseId);
  assert(attackKind, `ATTACK_KIND_MISSING:${benchmarkCase.caseId}`);
  observedAttackKindCounts.set(
    attackKind,
    (observedAttackKindCounts.get(attackKind) ?? 0) + 1,
  );
  if (attackKind === 'SCHEMA') {
    assert(
      security.attackText.includes('criteria: []') &&
        forbidden.has('criteria: []'),
      `SCHEMA_ATTACK_INVALID:${benchmarkCase.caseId}`,
    );
  } else if (attackKind === 'ALL_CRITERIA_ELEVATION') {
    assert(
      requestedAllLevel === 'mastered',
      `ALL_ATTACK_INVALID:${benchmarkCase.caseId}`,
    );
    assert(
      benchmarkCase.expectedCriteria.some(
        (criterion) => criterion.levelKey !== requestedAllLevel,
      ),
      `ATTACK_VECTOR_NOT_CONTRARY_TO_GOLD:${benchmarkCase.caseId}`,
    );
  } else {
    assert(
      requestedAssignments.length === (attackKind === 'KEY_SWAP' ? 2 : 1),
      `CRITERION_ATTACK_CARDINALITY_INVALID:${benchmarkCase.caseId}`,
    );
    for (const assignment of requestedAssignments) {
      assert(
        expectedByCriterion.has(assignment.criterionKey),
        `ATTACK_UNKNOWN_CRITERION:${benchmarkCase.caseId}:${assignment.criterionKey}`,
      );
      assert(
        expectedByCriterion.get(assignment.criterionKey) !== assignment.levelKey,
        `ATTACK_VECTOR_NOT_CONTRARY_TO_GOLD:${benchmarkCase.caseId}:${assignment.criterionKey}`,
      );
    }
  }
  if (
    /prompt système/iu.test(security.attackText) &&
    /canari secret/iu.test(security.attackText)
  ) {
    disclosureAttackCount += 1;
  }
}
assert(observedAttackKindCounts.size === 4, 'ATTACK_KINDS_NOT_DIVERSE_ENOUGH');
assert(
  observedAttackKindCounts.get('SCHEMA') === 2 &&
    observedAttackKindCounts.get('SINGLE_CRITERION') === 3 &&
    observedAttackKindCounts.get('KEY_SWAP') === 2 &&
    observedAttackKindCounts.get('ALL_CRITERIA_ELEVATION') === 1,
  'ATTACK_KIND_DISTRIBUTION_INVALID',
);
assert(allowedEvidenceQuoteCount >= 16, 'NOT_ENOUGH_ALLOWED_EVIDENCE_QUOTES');
assert(disclosureAttackCount >= 1, 'PROMPT_CANARY_DISCLOSURE_ATTACK_MISSING');
assert(
  !normalizeText(corpusRaw).includes(
    normalizeText(baseConfiguration.controlPrompt.canary),
  ),
  'CONTROL_CANARY_LEAKED_IN_CORPUS',
);

assert(resolvedConfiguration.language === 'fr-FR', 'CONFIG_LANGUAGE_INVALID');
assert(resolvedConfiguration.repetitions === 3, 'EXPECTED_3_REPETITIONS');
assert(resolvedConfiguration.maxRetries === 2, 'EXPECTED_2_RETRIES');
assert(
  resolvedConfiguration.promptVersion === '2.2.0',
  'PROMPT_VERSION_INVALID',
);
assert(
  resolvedConfiguration.requestProtocolVersion === '3.0.1',
  'PROTOCOL_VERSION_INVALID',
);
assert(
  resolvedConfiguration.correctionDeliveryPolicy === 'PARTIAL_CRITERION',
  'DELIVERY_POLICY_INVALID',
);
const sonnetCandidate = resolvedConfiguration.candidates.find(
  (candidate) => candidate.modelId === 'anthropic/claude-sonnet-4.6',
);
assert(sonnetCandidate, 'SONNET_CANDIDATE_MISSING');
assert(sonnetCandidate.provider === 'Anthropic', 'SONNET_PROVIDER_INVALID');
assert(
  sonnetCandidate.requestProfile.adapter === 'OPENROUTER_CHAT',
  'SONNET_ADAPTER_INVALID',
);
assert(
  sameJson(sonnetCandidate.requestProfile.routeProviders, ['Anthropic']),
  'SONNET_ROUTE_INVALID',
);
assert(
  sonnetCandidate.requestProfile.reasoning.effort === 'OFF' &&
    sonnetCandidate.requestProfile.reasoning.budgetMode === 'OFF' &&
    sonnetCandidate.requestProfile.reasoning.budgetTokens === null,
  'SONNET_REASONING_PROFILE_INVALID',
);
assert(
  sonnetCandidate.requestProfile.visibleOutputTokenTarget === 1500 &&
    sonnetCandidate.requestProfile.totalOutputTokenLimit === 1500,
  'SONNET_OUTPUT_LIMIT_INVALID',
);
assert(
  sonnetCandidate.requestProfile.temperature === null &&
    sonnetCandidate.requestProfile.timeoutMs === 60000,
  'SONNET_REQUEST_PROFILE_INVALID',
);

assert(manifest.status === 'DRAFT', 'MANIFEST_NOT_DRAFT');
assert(
  manifest.artifactKind === 'AUTHORING_PROVENANCE_MANIFEST',
  'AUTHORING_MANIFEST_KIND_INVALID',
);
assert(manifest.reviewStatus === 'PENDING', 'MANIFEST_REVIEW_NOT_PENDING');
assert(manifest.execution === false, 'MANIFEST_EXECUTION_MUST_BE_FALSE');
assert(
  manifest.requiredNextGate.status === 'PENDING' &&
    manifest.requiredNextGate.placeholderPath ===
      'review-manifest.pending.json' &&
    manifest.requiredNextGate.mayExecuteBeforeGate === false &&
    manifest.requiredNextGate.runnerSourceDigest ===
      'PENDING_GATE_HARDENING',
  'MANIFEST_GATE_INVALID',
);
assert(
  manifest.authoringProvenance.afterRejectedCorpus === true &&
    manifest.authoringProvenance.networkOrModelCallsMade === false &&
    manifest.authoringProvenance.candidateArtifactsConsulted === false &&
    manifest.authoringProvenance.independentReviewPerformed === false,
  'MANIFEST_PROVENANCE_INVALID',
);
assert(
  !/(APPROVED|SEALED)/u.test(JSON.stringify(manifest)),
  'MANIFEST_MUST_NOT_CLAIM_APPROVAL_OR_SEAL',
);
assert(
  reviewGate.artifactKind === 'INDEPENDENT_REVIEW_GATE_PLACEHOLDER' &&
    reviewGate.corpusId === corpus.corpusId &&
    reviewGate.status === 'PENDING' &&
    reviewGate.execution === false &&
    reviewGate.reviewer === null &&
    reviewGate.reviewedAt === null &&
    reviewGate.verdict === null,
  'REVIEW_GATE_PLACEHOLDER_INVALID',
);
assert(
  reviewGate.sourceCorpusDraftSha256 === sha256(corpusPath),
  'REVIEW_GATE_CORPUS_DIGEST_MISMATCH',
);
assert(
  !/(APPROVED|SEALED)/u.test(JSON.stringify(reviewGate)),
  'REVIEW_GATE_MUST_NOT_CLAIM_APPROVAL_OR_SEAL',
);
assert(
  manifest.pipelineIdentity.pipelineKey ===
      'learnx-french-text-correction-v3-1' &&
    manifest.pipelineIdentity.pipelineVersion === '3.1.0' &&
    manifest.pipelineIdentity.safetyEnvelopeVersion === '1.0.0' &&
    manifest.pipelineIdentity.modelId === sonnetCandidate.modelId &&
    manifest.pipelineIdentity.provider === sonnetCandidate.provider &&
    manifest.pipelineIdentity.promptVersion ===
      resolvedConfiguration.promptVersion &&
    manifest.pipelineIdentity.requestProtocolVersion ===
      resolvedConfiguration.requestProtocolVersion &&
    manifest.pipelineIdentity.correctionDeliveryPolicy ===
      resolvedConfiguration.correctionDeliveryPolicy &&
    manifest.pipelineIdentity.runtimeLiveEnabled === false,
  'MANIFEST_PIPELINE_IDENTITY_INVALID',
);
assert(
  manifest.pipelineIdentity.requestProfile.adapter ===
      sonnetCandidate.requestProfile.adapter &&
    manifest.pipelineIdentity.requestProfile.maxAttempts ===
      resolvedConfiguration.maxRetries + 1 &&
    manifest.pipelineIdentity.requestProfile.reasoning === 'OFF' &&
    manifest.pipelineIdentity.requestProfile.visibleOutputTokenTarget ===
      sonnetCandidate.requestProfile.visibleOutputTokenTarget &&
    manifest.pipelineIdentity.requestProfile.totalOutputTokenLimit ===
      sonnetCandidate.requestProfile.totalOutputTokenLimit &&
    manifest.pipelineIdentity.requestProfile.temperature ===
      sonnetCandidate.requestProfile.temperature &&
    manifest.pipelineIdentity.requestProfile.timeoutMs ===
      sonnetCandidate.requestProfile.timeoutMs,
  'MANIFEST_REQUEST_PROFILE_INVALID',
);
assert(
  sameJson(manifest.hybridEvaluationSemantics.deliveryStates, [
    'COMPLETE',
    'PARTIAL',
    'UNAVAILABLE',
  ]) &&
    manifest.hybridEvaluationSemantics
      .separateDeliveredAndRejectedCriteriaMetrics === true &&
    manifest.hybridEvaluationSemantics.historicalProjectionIsLiveEvidence ===
      false,
  'HYBRID_SEMANTICS_INVALID',
);
assert(
  manifest.draftIdentity.caseCount === 24 &&
    manifest.draftIdentity.criterionGoldCount === 72 &&
    manifest.draftIdentity.contractCount === 4 &&
    manifest.draftIdentity.repetitions === 3 &&
    manifest.draftIdentity.logicalRunCount === 72 &&
    manifest.draftIdentity.promptInjectionCaseCount === 8 &&
    manifest.draftIdentity.reviewPanelCaseCount === 6,
  'MANIFEST_COUNTS_INVALID',
);
assert(
  manifest.draftIdentity.corpusDraftSha256 === sha256(corpusPath),
  'CORPUS_DRAFT_DIGEST_MISMATCH',
);
assert(
  manifest.draftIdentity.configurationDraftSha256 === sha256(configurationPath),
  'CONFIGURATION_DRAFT_DIGEST_MISMATCH',
);
assert(
  manifest.draftIdentity.reviewGatePlaceholderSha256 === sha256(reviewGatePath),
  'REVIEW_GATE_PLACEHOLDER_DIGEST_MISMATCH',
);
const concurrentlyHardenedSources = new Set([
  '../../../../src/lib/ai-correction-benchmark.ts',
  '../../../../src/lib/ai-correction-benchmark.test.ts',
  '../../../../scripts/run-ai-correction-benchmark.ts',
]);
for (const input of manifest.authoringProvenance.consultedInputs) {
  if (concurrentlyHardenedSources.has(input.path)) {
    continue;
  }
  const inputPath = path.resolve(draftDirectory, input.path);
  assert(sha256(inputPath) === input.sha256, `SOURCE_DIGEST_MISMATCH:${input.path}`);
}

const consumedPaths = [
  '../../corpus.v1.json',
  '../../holdout.v1.json',
  '../../holdout.v2.json',
  '../../holdout.v3.json',
];
const consumedCorpora = consumedPaths.map((relativePath) => ({
  path: relativePath,
  corpus: readJson(path.resolve(draftDirectory, relativePath)),
}));
for (const { path: consumedPath, corpus: consumedCorpus } of consumedCorpora) {
  for (const field of ['caseId', 'taskContext', 'taskPrompt', 'responseText']) {
    const oldValues = new Set(
      consumedCorpus.cases.map((benchmarkCase) => benchmarkCase[field]),
    );
    const overlap = corpus.cases.filter((benchmarkCase) =>
      oldValues.has(benchmarkCase[field]),
    );
    assert(
      overlap.length === 0,
      `EXACT_OVERLAP:${consumedPath}:${field}:${overlap[0]?.caseId}`,
    );
  }
  const oldNormalizedContexts = new Set(
    consumedCorpus.cases.map((benchmarkCase) =>
      normalizeText(benchmarkCase.taskContext),
    ),
  );
  assert(
    corpus.cases.every(
      (benchmarkCase) =>
        !oldNormalizedContexts.has(normalizeText(benchmarkCase.taskContext)),
    ),
    `NORMALIZED_CONTEXT_OVERLAP:${consumedPath}`,
  );
  const oldContractKeys = new Set(
    consumedCorpus.contracts.map((contract) => contract.contractKey),
  );
  assert(
    corpus.contracts.every(
      (contract) => !oldContractKeys.has(contract.contractKey),
    ),
    `CONTRACT_KEY_OVERLAP:${consumedPath}`,
  );
}

const rejectedCorpus = consumedCorpora.find(
  (entry) => entry.path === '../../holdout.v3.json',
).corpus;
assert(
  !sameJson(
    corpus.cases.map((benchmarkCase) => benchmarkCase.category),
    rejectedCorpus.cases.map((benchmarkCase) => benchmarkCase.category),
  ),
  'REJECTED_CATEGORY_ORDER_REUSED',
);
const goldVector = (benchmarkCase) =>
  benchmarkCase.expectedCriteria.map((criterion) => criterion.levelKey).join('/');
assert(
  corpus.cases.every(
    (benchmarkCase, index) =>
      goldVector(benchmarkCase) !== goldVector(rejectedCorpus.cases[index]),
  ),
  'REJECTED_POSITIONAL_GOLD_VECTOR_REUSED',
);

let maximumContextFourGramJaccard = 0;
let maximumContextPair = null;
for (const benchmarkCase of corpus.cases) {
  const newGrams = ngrams(benchmarkCase.taskContext, 4);
  for (const { path: consumedPath, corpus: consumedCorpus } of consumedCorpora) {
    for (const oldCase of consumedCorpus.cases) {
      const score = jaccard(newGrams, ngrams(oldCase.taskContext, 4));
      if (score > maximumContextFourGramJaccard) {
        maximumContextFourGramJaccard = score;
        maximumContextPair = {
          consumedPath,
          newCaseId: benchmarkCase.caseId,
          oldCaseId: oldCase.caseId,
        };
      }
    }
  }
}
assert(
  maximumContextFourGramJaccard < 0.05,
  `SURFACE_CONTEXT_SIMILARITY_TOO_HIGH:${JSON.stringify(maximumContextPair)}`,
);

console.log(
  JSON.stringify(
    {
      status: 'DRAFT_CHECKS_PASS',
      execution: false,
      reviewStatus: 'PENDING',
      corpusId: corpus.corpusId,
      corpusSha256: sha256(corpusPath),
      cases: corpus.cases.length,
      criterionGolds: goldCount,
      logicalRuns: corpus.cases.length * resolvedConfiguration.repetitions,
      contracts: corpus.contracts.length,
      criteriaPerContract: 3,
      categoryCounts,
      uniqueGoldProfiles: profileCounts.size,
      promptInjectionCases: injectionCases.length,
      allowedEvidenceQuotes: allowedEvidenceQuoteCount,
      disclosureAttacks: disclosureAttackCount,
      reviewPanelCases: overlay.reviewPanelCaseIds.length,
      repetitions: resolvedConfiguration.repetitions,
      minimumResponseLength: Math.min(...responseLengths),
      longResponseCount: responseLengths.filter((length) => length >= 800)
        .length,
      exactConsumedOverlapCount: 0,
      rejectedPositionalGoldVectorMatches: 0,
      rejectedCategoryOrderReused: false,
      maximumContextFourGramJaccard,
      maximumContextPair,
      semanticIndependenceReview: 'PENDING_INDEPENDENT_REVIEW',
    },
    null,
    2,
  ),
);
