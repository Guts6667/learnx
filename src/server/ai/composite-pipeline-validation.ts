import { createHash } from 'node:crypto';

import type { CorrectionContract } from '@/lib/ai-correction-contracts';

import {
  calculateIndicativeScore,
  type RoleObservation,
} from './composite-correction.js';

export const V4_009B_PANEL_CASE_IDS = [
  'benchmark-writing-successful',
  'benchmark-practice-erroneous',
  'benchmark-project-partial',
  'benchmark-writing-ambiguous',
  'benchmark-reflection-partial',
  'benchmark-practice-prompt-injection',
] as const;

export interface CompositePanelCell {
  caseDigest: string;
  caseId: string;
  repetition: 1 | 2;
}

export interface CompositeRunBudget {
  absoluteCampaignMaximumProviderCalls: 48;
  expectedWithoutRetryUsd: number;
  maximumInitialVerifierCalls: number;
  maximumProviderCalls: number;
  maximumTechnicalRetriesPerRoleAndCell: 1;
  maximumUsageCostUsd: number;
  status: 'ARBITRATED';
}

export interface CompositeRunEnvelope {
  authorization: 'GRANTED' | 'OWNER_GO_REQUIRED';
  budget: CompositeRunBudget;
  cells: readonly CompositePanelCell[];
  corpusId: string;
  corpusSha256: string;
  identity: unknown;
  panelVersion: string;
  repetitions: 2;
  status: 'DRAFT' | 'FROZEN';
}

export interface CompositeRunProgress {
  completedCellKeys: readonly string[];
  providerCalls: number;
  reservedInFlightUsd: number;
  usageCostUsd: number;
}

export type V4009BTriggerReason =
  | 'CONTROL_SAMPLE'
  | 'DECISION_SENSITIVE'
  | 'SECURITY_REVIEW'
  | 'USABLE_VALIDATION_WARNING';

export type V4009BDisagreement =
  'EXACT_AGREEMENT' | 'MATERIAL_DISAGREEMENT' | 'NON_MATERIAL_DISAGREEMENT';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function createCompositeRunEnvelopeFingerprint(
  envelope: CompositeRunEnvelope,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize({ ...envelope, authorization: 'OWNER_GO_REQUIRED' }),
      ),
    )
    .digest('hex');
}

export function compositePanelCellKey(cell: {
  caseId: string;
  repetition: number;
}): string {
  return `${cell.caseId}:${cell.repetition}`;
}

export function buildCompositePanelCells(
  digests: Readonly<Record<(typeof V4_009B_PANEL_CASE_IDS)[number], string>>,
): CompositePanelCell[] {
  return V4_009B_PANEL_CASE_IDS.flatMap((caseId) =>
    ([1, 2] as const).map((repetition) => ({
      caseDigest: digests[caseId],
      caseId,
      repetition,
    })),
  );
}

export function assertFrozenCompositeRunEnvelope(
  envelope: CompositeRunEnvelope,
): void {
  if (envelope.status !== 'FROZEN') {
    throw new Error('COMPOSITE_RUN_ENVELOPE_NOT_FROZEN');
  }
  if (
    envelope.cells.length !== 12 ||
    new Set(envelope.cells.map(compositePanelCellKey)).size !== 12 ||
    envelope.cells.some(
      (cell) =>
        !V4_009B_PANEL_CASE_IDS.includes(
          cell.caseId as (typeof V4_009B_PANEL_CASE_IDS)[number],
        ) || !/^[a-f0-9]{64}$/.test(cell.caseDigest),
    )
  ) {
    throw new Error('COMPOSITE_RUN_PANEL_INVALID');
  }
  if (
    !/^[a-f0-9]{64}$/.test(envelope.corpusSha256) ||
    envelope.budget.status !== 'ARBITRATED' ||
    envelope.budget.maximumInitialVerifierCalls !== 10 ||
    envelope.budget.absoluteCampaignMaximumProviderCalls !== 48 ||
    envelope.budget.maximumProviderCalls !== 44 ||
    envelope.budget.maximumTechnicalRetriesPerRoleAndCell !== 1 ||
    envelope.budget.maximumUsageCostUsd <= 0 ||
    envelope.budget.expectedWithoutRetryUsd < 0 ||
    envelope.budget.expectedWithoutRetryUsd >
      envelope.budget.maximumUsageCostUsd
  ) {
    throw new Error('COMPOSITE_RUN_BUDGET_INVALID');
  }
  if (JSON.stringify(envelope.identity).includes('PENDING_')) {
    throw new Error('COMPOSITE_RUN_IDENTITY_NOT_ARBITRATED');
  }
}

export function assertCompositeRunCallAllowed(input: {
  envelope: CompositeRunEnvelope;
  estimatedWorstCaseNextCallUsd: number;
  progress: CompositeRunProgress;
}): void {
  assertFrozenCompositeRunEnvelope(input.envelope);
  if (input.envelope.authorization !== 'GRANTED') {
    throw new Error('COMPOSITE_RUN_OWNER_GO_REQUIRED');
  }
  if (
    !Number.isFinite(input.estimatedWorstCaseNextCallUsd) ||
    input.estimatedWorstCaseNextCallUsd <= 0
  ) {
    throw new Error('COMPOSITE_RUN_WORST_CASE_COST_INVALID');
  }
  if (
    input.progress.providerCalls + 1 >
    input.envelope.budget.maximumProviderCalls
  ) {
    throw new Error('ATTEMPT_CAP_REACHED');
  }
  if (
    input.progress.usageCostUsd +
      input.progress.reservedInFlightUsd +
      input.estimatedWorstCaseNextCallUsd >
    input.envelope.budget.maximumUsageCostUsd
  ) {
    throw new Error('BUDGET_CAP_PREVENTED_CALL');
  }
}

function levelIndex(
  contract: CorrectionContract,
  criterionKey: string,
  levelKey: string,
): number {
  const levels = contract.criteria
    .find((criterion) => criterion.key === criterionKey)
    ?.performanceLevels.toSorted((left, right) => left.score - right.score);
  const index = levels?.findIndex((level) => level.key === levelKey) ?? -1;
  if (index < 0) throw new Error('COMPOSITE_OBSERVATION_INVALID');
  return index;
}

function isAboveInternalBoundary(score: number, passingScore: number): boolean {
  return score >= passingScore;
}

export function isV4009BDecisionSensitive(input: {
  contract: CorrectionContract;
  primary: RoleObservation;
}): boolean {
  const baseScore = calculateIndicativeScore({
    contract: input.contract,
    observation: input.primary,
  });
  const baseSide = isAboveInternalBoundary(
    baseScore,
    input.contract.passingScore,
  );
  return input.primary.criteria.some((observation, observationIndex) => {
    const criterion = input.contract.criteria.find(
      (candidate) => candidate.key === observation.criterionKey,
    );
    if (!criterion) throw new Error('COMPOSITE_OBSERVATION_INVALID');
    const levels = criterion.performanceLevels.toSorted(
      (left, right) => left.score - right.score,
    );
    const currentIndex = levelIndex(
      input.contract,
      observation.criterionKey,
      observation.levelKey,
    );
    return [currentIndex - 1, currentIndex + 1].some((adjacentIndex) => {
      const adjacent = levels[adjacentIndex];
      if (!adjacent) return false;
      const criteria = input.primary.criteria.map((current, index) =>
        index === observationIndex
          ? { ...current, levelKey: adjacent.key }
          : current,
      );
      const adjacentScore = calculateIndicativeScore({
        contract: input.contract,
        observation: { ...input.primary, criteria },
      });
      return (
        isAboveInternalBoundary(adjacentScore, input.contract.passingScore) !==
        baseSide
      );
    });
  });
}

export function deriveV4009BTriggerReasons(input: {
  controlSample: boolean;
  contract: CorrectionContract;
  deterministicSecurityReview: boolean;
  primary: RoleObservation;
  usableValidationWarning: boolean;
}): readonly V4009BTriggerReason[] {
  const reasons: V4009BTriggerReason[] = [];
  if (isV4009BDecisionSensitive(input)) reasons.push('DECISION_SENSITIVE');
  if (input.deterministicSecurityReview) reasons.push('SECURITY_REVIEW');
  if (input.usableValidationWarning) reasons.push('USABLE_VALIDATION_WARNING');
  if (reasons.length === 0 && input.controlSample)
    reasons.push('CONTROL_SAMPLE');
  return reasons;
}

export function classifyV4009BDisagreement(input: {
  contract: CorrectionContract;
  hasEvidenceOrSecurityConflict: boolean;
  primary: RoleObservation;
  verifier: RoleObservation;
}): V4009BDisagreement {
  const verifierByKey = new Map(
    input.verifier.criteria.map((criterion) => [
      criterion.criterionKey,
      criterion,
    ]),
  );
  const distances = input.primary.criteria.map((primary) => {
    const verifier = verifierByKey.get(primary.criterionKey);
    if (!verifier) throw new Error('COMPOSITE_OBSERVATION_INVALID');
    return Math.abs(
      levelIndex(input.contract, primary.criterionKey, primary.levelKey) -
        levelIndex(input.contract, verifier.criterionKey, verifier.levelKey),
    );
  });
  const differingCriteria = distances.filter((distance) => distance > 0);
  if (differingCriteria.length === 0 && !input.hasEvidenceOrSecurityConflict) {
    return 'EXACT_AGREEMENT';
  }
  const primaryScore = calculateIndicativeScore({
    contract: input.contract,
    observation: input.primary,
  });
  const verifierScore = calculateIndicativeScore({
    contract: input.contract,
    observation: input.verifier,
  });
  const oppositeSides =
    isAboveInternalBoundary(primaryScore, input.contract.passingScore) !==
    isAboveInternalBoundary(verifierScore, input.contract.passingScore);
  return input.hasEvidenceOrSecurityConflict ||
    oppositeSides ||
    differingCriteria.some((distance) => distance >= 2) ||
    differingCriteria.length >= 2
    ? 'MATERIAL_DISAGREEMENT'
    : 'NON_MATERIAL_DISAGREEMENT';
}

export interface BlindReviewEntryInput {
  candidateConsolidation: unknown;
  contractKey: string;
  contractVersion: string;
  outputs: readonly [unknown, unknown?];
  rubric: unknown;
  responseText: string;
  taskContext: string;
  taskPrompt: string;
}

export interface BlindReviewEntry extends BlindReviewEntryInput {
  reviewId: string;
}

export function createBlindReviewEntry(
  reviewId: string,
  input: BlindReviewEntryInput,
): BlindReviewEntry {
  const outputs = [...input.outputs];
  const randomizationByte = createHash('sha256').update(reviewId).digest().at(0);
  if (
    outputs.length === 2 &&
    randomizationByte !== undefined &&
    randomizationByte % 2 === 1
  ) {
    outputs.reverse();
  }
  return {
    candidateConsolidation: input.candidateConsolidation,
    contractKey: input.contractKey,
    contractVersion: input.contractVersion,
    outputs: outputs as [unknown, unknown?],
    reviewId,
    rubric: input.rubric,
    responseText: input.responseText,
    taskContext: input.taskContext,
    taskPrompt: input.taskPrompt,
  };
}

export function createBlindReviewMapping(input: {
  entries: readonly { caseId: string; repetition: number; reviewId: string }[];
  envelopeFingerprint: string;
}): {
  entries: readonly { caseId: string; repetition: number; reviewId: string }[];
  envelopeFingerprint: string;
  mappingSha256: string;
} {
  const mappingSha256 = createHash('sha256')
    .update(JSON.stringify(canonicalize(input)))
    .digest('hex');
  return { ...input, mappingSha256 };
}
