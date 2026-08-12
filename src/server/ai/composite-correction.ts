import { createHash } from 'node:crypto';

import type { CorrectionContract } from '@/lib/ai-correction-contracts';

export const COMPOSITE_PIPELINE_STATES = [
  'COMPLETED',
  'PROVISIONAL',
  'UNCERTAIN',
  'UNUSABLE_RELEASED',
] as const;

export type CompositePipelineState = (typeof COMPOSITE_PIPELINE_STATES)[number];
export type CompositeRole = 'PRIMARY' | 'TARGETED_VERIFIER';

export type CompositeWorkflowStatus =
  | 'RESERVED'
  | 'PROCESSING_PRIMARY'
  | 'VERIFYING'
  | 'RETRY_PENDING'
  | CompositePipelineState;

export interface CompositeRoleProfile {
  adapter: 'ANTHROPIC_MESSAGES' | 'OPENAI_RESPONSES' | 'OPENROUTER_CHAT';
  allowFallbacks: false;
  maxOutputTokens: number;
  modelId: string;
  profileVersion: string;
  promptVersion: string;
  reasoning: 'LOW' | 'MINIMAL' | 'OFF';
  routeProviders: readonly string[];
  temperature: number | null;
  timeoutMs: number;
}

export interface CompositePipelineIdentity {
  consolidatorVersion: string;
  pipelineKey: string;
  pipelineVersion: string;
  primary: CompositeRoleProfile;
  protocolVersion: string;
  triggerVersion: string;
  verifier: CompositeRoleProfile;
}

export interface CriterionObservation {
  confidence: number;
  criterionKey: string;
  evidenceQuotes: readonly string[];
  feedback: string;
  levelKey: string;
}

export interface RoleObservation {
  criteria: readonly CriterionObservation[];
  overallFeedback: string;
}

export interface TriggerConfiguration {
  active: boolean;
  confidenceThreshold: number | null;
  randomSampleRate: number | null;
  sensitiveCriterionKeys: readonly string[];
  scoreBoundaryDistance: number | null;
  version: string;
}

export interface TriggerSignals {
  outputValidationWarning: boolean;
  randomSample: number;
}

export interface ConsolidationConfiguration {
  active: boolean;
  allowPrimaryWhenVerifierFails: boolean;
  materialLevelDistance: number | null;
  materialScoreDistance: number | null;
  version: string;
}

export interface CompositeResult {
  indicativeScore: number | null;
  primary: RoleObservation | null;
  state: CompositePipelineState;
  verifier: RoleObservation | null;
}

export interface CompositeReleasePort {
  release(input: {
    correctionId: string;
    reason: 'NO_USABLE_COMPOSITE_RESULT';
  }): Promise<void>;
}

export interface CompositeRoleAttempt {
  attemptNumber: number;
  errorCode: string | null;
  internalCostUsd: number;
  observation: RoleObservation | null;
  status: 'ERROR' | 'INVALID' | 'VALID';
}

export interface CompositeRoleExecutionResult {
  attempts: readonly CompositeRoleAttempt[];
  observation: RoleObservation | null;
  role: CompositeRole;
}

export interface CompositeRoleGenerationPort {
  execute(input: {
    identity: CompositePipelineIdentity;
    request: ReturnType<typeof buildCompositeRoleRequest>;
    role: CompositeRole;
  }): Promise<CompositeRoleExecutionResult>;
}

export interface CompositeWorkflowRepository {
  complete(input: {
    correctionId: string;
    result: CompositeResult;
  }): Promise<void>;
  recordRoleExecution(input: {
    correctionId: string;
    execution: CompositeRoleExecutionResult;
    profile: CompositeRoleProfile;
  }): Promise<void>;
  start(input: {
    correctionId: string;
    identity: CompositePipelineIdentity;
    pipelineFingerprint: string;
  }): Promise<void>;
}

export interface ExecuteCompositeWorkflowInput {
  consolidationConfiguration: ConsolidationConfiguration;
  contract: CorrectionContract;
  correctionId: string;
  generationPort: CompositeRoleGenerationPort;
  identity: CompositePipelineIdentity;
  primaryPromptSnapshot: unknown;
  releasePort: CompositeReleasePort;
  repository: CompositeWorkflowRepository;
  submissionSnapshot: unknown;
  triggerConfiguration: TriggerConfiguration;
  triggerSignals: TriggerSignals;
  verifierPromptSnapshot: unknown;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function createCompositePipelineFingerprint(
  identity: CompositePipelineIdentity,
): string {
  validateCompositePipelineIdentity(identity);
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(identity)))
    .digest('hex');
}

export function validateCompositePipelineIdentity(
  identity: CompositePipelineIdentity,
): void {
  const profiles = [identity.primary, identity.verifier];
  if (
    profiles.some(
      (profile) =>
        profile.routeProviders.length === 0 ||
        profile.allowFallbacks !== false ||
        /(^|[/_-])(auto|latest|free|beta)(?:$|[/_:-])/i.test(profile.modelId) ||
        profile.routeProviders.some((provider) => provider.trim().length === 0),
    )
  ) {
    throw new Error('COMPOSITE_PIPELINE_IDENTITY_INVALID');
  }
}

const allowedTransitions: Readonly<
  Record<CompositeWorkflowStatus, readonly CompositeWorkflowStatus[]>
> = {
  COMPLETED: [],
  PROCESSING_PRIMARY: [
    'COMPLETED',
    'RETRY_PENDING',
    'UNUSABLE_RELEASED',
    'VERIFYING',
  ],
  PROVISIONAL: [],
  RESERVED: ['PROCESSING_PRIMARY'],
  RETRY_PENDING: ['PROCESSING_PRIMARY', 'VERIFYING', 'UNUSABLE_RELEASED'],
  UNCERTAIN: [],
  UNUSABLE_RELEASED: [],
  VERIFYING: [
    'COMPLETED',
    'PROVISIONAL',
    'RETRY_PENDING',
    'UNCERTAIN',
    'UNUSABLE_RELEASED',
  ],
};

export function assertCompositeTransition(
  from: CompositeWorkflowStatus,
  to: CompositeWorkflowStatus,
): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error('COMPOSITE_TRANSITION_INVALID');
  }
}

function assertObservation(
  contract: CorrectionContract,
  observation: RoleObservation,
): void {
  const expected = new Set(contract.criteria.map((criterion) => criterion.key));
  const actual = new Set(
    observation.criteria.map((criterion) => criterion.criterionKey),
  );
  if (
    actual.size !== observation.criteria.length ||
    actual.size !== expected.size
  ) {
    throw new Error('COMPOSITE_CRITERIA_MISMATCH');
  }
  for (const result of observation.criteria) {
    const criterion = contract.criteria.find(
      (item) => item.key === result.criterionKey,
    );
    if (
      !criterion ||
      !criterion.performanceLevels.some(
        (level) => level.key === result.levelKey,
      ) ||
      result.confidence < 0 ||
      result.confidence > 1
    ) {
      throw new Error('COMPOSITE_OBSERVATION_INVALID');
    }
  }
}

export function calculateIndicativeScore(input: {
  contract: CorrectionContract;
  observation: RoleObservation;
}): number {
  assertObservation(input.contract, input.observation);
  const results = new Map(
    input.observation.criteria.map((criterion) => [
      criterion.criterionKey,
      criterion,
    ]),
  );
  const score = input.contract.criteria.reduce((total, criterion) => {
    const result = results.get(criterion.key);
    const level = criterion.performanceLevels.find(
      (candidate) => candidate.key === result?.levelKey,
    );
    if (!level) throw new Error('COMPOSITE_OBSERVATION_INVALID');
    return total + (criterion.weight * level.score) / 100;
  }, 0);
  return Math.round(score * 100) / 100;
}

export function shouldTriggerTargetedVerifier(input: {
  configuration: TriggerConfiguration;
  contract: CorrectionContract;
  primary: RoleObservation;
  signals: TriggerSignals;
}): boolean {
  assertObservation(input.contract, input.primary);
  if (!input.configuration.active) return false;
  const confidenceThreshold = input.configuration.confidenceThreshold;
  const reasons = [
    confidenceThreshold !== null &&
      input.primary.criteria.some(
        (criterion) => criterion.confidence < confidenceThreshold,
      ),
    input.primary.criteria.some((criterion) =>
      input.configuration.sensitiveCriterionKeys.includes(
        criterion.criterionKey,
      ),
    ),
    input.signals.outputValidationWarning,
    input.configuration.randomSampleRate !== null &&
      input.signals.randomSample < input.configuration.randomSampleRate,
  ];
  if (input.configuration.scoreBoundaryDistance !== null) {
    const score = calculateIndicativeScore({
      contract: input.contract,
      observation: input.primary,
    });
    reasons.push(
      Math.abs(score - input.contract.passingScore) <=
        input.configuration.scoreBoundaryDistance,
    );
  }
  return reasons.some(Boolean);
}

function levelOrdinal(
  contract: CorrectionContract,
  criterionKey: string,
  levelKey: string,
): number {
  const criterion = contract.criteria.find((item) => item.key === criterionKey);
  const levels = [...(criterion?.performanceLevels ?? [])].sort(
    (left, right) => left.score - right.score,
  );
  const index = levels.findIndex((level) => level.key === levelKey);
  if (index < 0) throw new Error('COMPOSITE_OBSERVATION_INVALID');
  return index;
}

export function consolidateCompositeCorrection(input: {
  configuration: ConsolidationConfiguration;
  contract: CorrectionContract;
  primary: RoleObservation | null;
  verifier: RoleObservation | null;
  verifierTriggered: boolean;
}): CompositeResult {
  if (!input.configuration.active)
    throw new Error('COMPOSITE_PIPELINE_INACTIVE');
  if (!input.primary) {
    return {
      indicativeScore: null,
      primary: null,
      state: 'UNUSABLE_RELEASED',
      verifier: null,
    };
  }
  assertObservation(input.contract, input.primary);
  const primaryScore = calculateIndicativeScore({
    contract: input.contract,
    observation: input.primary,
  });
  if (!input.verifierTriggered) {
    return {
      indicativeScore: primaryScore,
      primary: input.primary,
      state: 'COMPLETED',
      verifier: null,
    };
  }
  if (!input.verifier) {
    return input.configuration.allowPrimaryWhenVerifierFails
      ? {
          indicativeScore: primaryScore,
          primary: input.primary,
          state: 'PROVISIONAL',
          verifier: null,
        }
      : {
          indicativeScore: null,
          primary: input.primary,
          state: 'UNUSABLE_RELEASED',
          verifier: null,
        };
  }
  assertObservation(input.contract, input.verifier);
  if (
    input.configuration.materialLevelDistance === null ||
    input.configuration.materialScoreDistance === null
  ) {
    throw new Error('COMPOSITE_CONSOLIDATOR_NOT_CALIBRATED');
  }
  const materialLevelDistance = input.configuration.materialLevelDistance;
  const verifierResults = new Map(
    input.verifier.criteria.map((criterion) => [
      criterion.criterionKey,
      criterion,
    ]),
  );
  const materialLevelDifference = input.primary.criteria.some((criterion) => {
    const verifier = verifierResults.get(criterion.criterionKey);
    if (!verifier) throw new Error('COMPOSITE_OBSERVATION_INVALID');
    return (
      Math.abs(
        levelOrdinal(
          input.contract,
          criterion.criterionKey,
          criterion.levelKey,
        ) -
          levelOrdinal(
            input.contract,
            criterion.criterionKey,
            verifier.levelKey,
          ),
      ) > materialLevelDistance
    );
  });
  const verifierScore = calculateIndicativeScore({
    contract: input.contract,
    observation: input.verifier,
  });
  if (
    materialLevelDifference ||
    Math.abs(primaryScore - verifierScore) >
      input.configuration.materialScoreDistance
  ) {
    return {
      indicativeScore: null,
      primary: input.primary,
      state: 'UNCERTAIN',
      verifier: input.verifier,
    };
  }
  return {
    indicativeScore: primaryScore,
    primary: input.primary,
    state: 'COMPLETED',
    verifier: input.verifier,
  };
}

export function buildCompositeRoleRequest(input: {
  contractSnapshot: unknown;
  promptSnapshot: unknown;
  role: CompositeRole;
  submissionSnapshot: unknown;
}): {
  contractSnapshot: unknown;
  promptSnapshot: unknown;
  role: CompositeRole;
  submissionSnapshot: unknown;
} {
  return {
    contractSnapshot: structuredClone(input.contractSnapshot),
    promptSnapshot: structuredClone(input.promptSnapshot),
    role: input.role,
    submissionSnapshot: structuredClone(input.submissionSnapshot),
  };
}

export async function confirmCompositeRelease(input: {
  correctionId: string;
  releasePort: CompositeReleasePort;
  result: CompositeResult;
}): Promise<CompositeResult> {
  if (input.result.state !== 'UNUSABLE_RELEASED') return input.result;
  await input.releasePort.release({
    correctionId: input.correctionId,
    reason: 'NO_USABLE_COMPOSITE_RESULT',
  });
  return input.result;
}

function validateRoleExecution(input: {
  execution: CompositeRoleExecutionResult;
  expectedRole: CompositeRole;
  maxAttempts: number;
}): void {
  if (
    input.execution.role !== input.expectedRole ||
    input.execution.attempts.length === 0 ||
    input.execution.attempts.length > input.maxAttempts ||
    input.execution.attempts.some(
      (attempt, index) => attempt.attemptNumber !== index + 1,
    )
  ) {
    throw new Error('COMPOSITE_ROLE_EXECUTION_INVALID');
  }
  const finalAttempt = input.execution.attempts.at(-1);
  if (
    (input.execution.observation === null) !==
      (finalAttempt?.status !== 'VALID') ||
    (finalAttempt?.status === 'VALID' &&
      JSON.stringify(canonicalize(finalAttempt.observation)) !==
        JSON.stringify(canonicalize(input.execution.observation)))
  ) {
    throw new Error('COMPOSITE_ROLE_EXECUTION_INVALID');
  }
}

export async function executeCompositeWorkflow(
  input: ExecuteCompositeWorkflowInput,
): Promise<CompositeResult> {
  const pipelineFingerprint = createCompositePipelineFingerprint(
    input.identity,
  );
  await input.repository.start({
    correctionId: input.correctionId,
    identity: input.identity,
    pipelineFingerprint,
  });

  const primary = await input.generationPort.execute({
    identity: input.identity,
    request: buildCompositeRoleRequest({
      contractSnapshot: input.contract,
      promptSnapshot: input.primaryPromptSnapshot,
      role: 'PRIMARY',
      submissionSnapshot: input.submissionSnapshot,
    }),
    role: 'PRIMARY',
  });
  validateRoleExecution({
    execution: primary,
    expectedRole: 'PRIMARY',
    maxAttempts: 2,
  });
  await input.repository.recordRoleExecution({
    correctionId: input.correctionId,
    execution: primary,
    profile: input.identity.primary,
  });

  let verifier: CompositeRoleExecutionResult | null = null;
  const verifierTriggered =
    primary.observation !== null &&
    shouldTriggerTargetedVerifier({
      configuration: input.triggerConfiguration,
      contract: input.contract,
      primary: primary.observation,
      signals: input.triggerSignals,
    });
  if (verifierTriggered) {
    verifier = await input.generationPort.execute({
      identity: input.identity,
      request: buildCompositeRoleRequest({
        contractSnapshot: input.contract,
        promptSnapshot: input.verifierPromptSnapshot,
        role: 'TARGETED_VERIFIER',
        submissionSnapshot: input.submissionSnapshot,
      }),
      role: 'TARGETED_VERIFIER',
    });
    validateRoleExecution({
      execution: verifier,
      expectedRole: 'TARGETED_VERIFIER',
      maxAttempts: 2,
    });
    await input.repository.recordRoleExecution({
      correctionId: input.correctionId,
      execution: verifier,
      profile: input.identity.verifier,
    });
  }

  let result = consolidateCompositeCorrection({
    configuration: input.consolidationConfiguration,
    contract: input.contract,
    primary: primary.observation,
    verifier: verifier?.observation ?? null,
    verifierTriggered,
  });
  result = await confirmCompositeRelease({
    correctionId: input.correctionId,
    releasePort: input.releasePort,
    result,
  });
  await input.repository.complete({ correctionId: input.correctionId, result });
  return result;
}
