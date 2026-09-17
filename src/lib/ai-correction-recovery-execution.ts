import { z } from 'zod';
import {
  RECOVERY_RUBRIC,
  recoveryExtractionSchema,
  recoveryVerificationSchema,
  type RecoveryCase,
  type RecoveryExtraction,
} from './ai-correction-recovery-contract';
import { recoveryHash } from './ai-correction-recovery-evaluation';
import {
  buildRecoveryVerificationInput,
  deliverRecoveryCorrection,
} from './ai-correction-recovery-pipeline';
import {
  buildRecoveryResearchRequest,
  parseRecoveryResearchPayload,
  type RecoveryExecutionPlan,
  type RecoveryObservation,
} from './ai-correction-recovery-execution-plan';
export { prepareRecoveryExecution } from './ai-correction-recovery-execution-plan';
const arms = ['SUPPLIED_EVIDENCE', 'EXTRACTED_EVIDENCE'] as const;
type Arm = (typeof arms)[number];
type Role = 'primary' | 'verifier';

function reviewedRoles(plan: RecoveryExecutionPlan, answer: RecoveryCase) {
  const row = plan.reference.labels.find(
    (label) => label.caseId === answer.caseId,
  );
  if (!row) throw new Error('RECOVERY_REFERENCE_MISSING');
  return row.criteria.map(({ criterionKey, roles }) => ({
    criterionKey,
    roles,
  }));
}
function suppliedExtraction(
  plan: RecoveryExecutionPlan,
  answer: RecoveryCase,
  extraction: RecoveryExtraction,
): RecoveryExtraction {
  const rows = reviewedRoles(plan, answer);
  return {
    criteria: extraction.criteria.map((row) => ({
      ...row,
      roles:
        rows.find((entry) => entry.criterionKey === row.criterionKey)?.roles ??
        {},
    })),
  };
}

export type RecoveryExecutionEvent =
  | {
      kind: 'CALL_INTENT';
      sequence: number;
      phase: 'SMOKE' | 'MEASUREMENT';
      cell: { caseId: string; arm: Arm; repetition: number };
      role: Role;
      requestHash: string;
      body: unknown;
    }
  | {
      kind: 'CALL_RESULT';
      sequence: number;
      rawEnvelope: unknown;
      costUsd: number | null;
      providerRequestId: string | null;
    }
  | { kind: 'CALL_FAILED'; sequence: number; reason: string }
  | {
      kind: 'OBSERVATION';
      observation: RecoveryObservation;
      delivered: ReturnType<typeof deliverRecoveryCorrection>;
    }
  | { kind: 'STOPPED'; reason: string };

const envelopeSchema = z.object({
  id: z.string().min(1),
  model: z.string(),
  provider: z.string(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string(),
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
  usage: z.object({
    cost: z.number().finite().nonnegative(),
    completion_tokens_details: z.object({ reasoning_tokens: z.literal(0) }),
  }),
});

/** Sequential, no implicit resume/retry. All transport must be budget-guarded by the caller. */
export async function executeRecoveryMeasurement(input: {
  plan: RecoveryExecutionPlan;
  apiKey: string;
  fetcher: typeof fetch;
  /** Check terminal billing state after each returned response, before admitting an observation. */
  assertReconciled: () => void;
  persist: (event: RecoveryExecutionEvent) => void;
  signal?: AbortSignal;
}) {
  const { plan } = input;
  if (plan.run.observations.length !== 0)
    throw new Error('RECOVERY_RESUME_REQUIRES_REVIEW');
  let sequence = 0;
  let stopped: string | null = null;
  const responseAccounting = {
    SMOKE: {
      knownCostUsd: 0,
      unpricedResponses: 0,
      transportOrBudgetFailures: 0,
    },
    MEASUREMENT: {
      knownCostUsd: 0,
      unpricedResponses: 0,
      transportOrBudgetFailures: 0,
    },
  };
  const call = async (
    role: Role,
    payload: unknown,
    phase: 'SMOKE' | 'MEASUREMENT',
    cell: { caseId: string; arm: Arm; repetition: number },
  ) => {
    input.signal?.throwIfAborted();
    const body = buildRecoveryResearchRequest(plan, role, payload);
    const current = ++sequence;
    input.persist({
      kind: 'CALL_INTENT',
      sequence: current,
      phase,
      cell,
      role,
      requestHash: recoveryHash(body),
      body,
    });
    let response: Response;
    let rawEnvelope: unknown;
    try {
      response = await input.fetcher(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://learn-x.app',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.any([
            AbortSignal.timeout(plan.protocol.profiles[role].timeoutMs),
            ...(input.signal ? [input.signal] : []),
          ]),
        },
      );
      rawEnvelope = await response.json();
    } catch {
      responseAccounting[phase].transportOrBudgetFailures += 1;
      input.persist({
        kind: 'CALL_FAILED',
        sequence: current,
        reason: 'RECOVERY_TRANSPORT_OR_BUDGET_INTERRUPTED',
      });
      throw new Error('RECOVERY_TRANSPORT_OR_BUDGET_INTERRUPTED');
    }
    // Request identity and cost are independent accounting facts, even in a malformed envelope.
    const identity = z.object({ id: z.string().min(1) }).safeParse(rawEnvelope);
    const cost = z
      .object({ usage: z.object({ cost: z.number().finite().nonnegative() }) })
      .safeParse(rawEnvelope);
    const costUsd = cost.success ? cost.data.usage.cost : null;
    const providerRequestId = identity.success ? identity.data.id : null;
    if (costUsd === null) responseAccounting[phase].unpricedResponses += 1;
    else responseAccounting[phase].knownCostUsd += costUsd;
    input.persist({
      kind: 'CALL_RESULT',
      sequence: current,
      rawEnvelope,
      costUsd,
      providerRequestId,
    });
    input.assertReconciled();
    if (costUsd === null)
      throw new Error('RECOVERY_UNKNOWN_COST_RECONCILIATION_REQUIRED');
    if (!providerRequestId)
      throw new Error('RECOVERY_PROVIDER_REQUEST_ID_MISSING');
    if (!response.ok) throw new Error(`RECOVERY_HTTP_${response.status}`);
    const envelope = envelopeSchema.safeParse(rawEnvelope);
    const pin = plan.protocol.profiles[role];
    if (
      !envelope.success ||
      envelope.data.model !== pin.modelId ||
      envelope.data.provider !== pin.provider
    )
      throw new Error('RECOVERY_TRANSPORT_PROFILE_UNVERIFIED');
    const choice = envelope.data.choices[0];
    let payloadOutput: unknown = null;
    if (choice.finish_reason === 'stop') {
      try {
        payloadOutput = parseRecoveryResearchPayload(
          JSON.parse(choice.message.content),
          role,
        );
      } catch {
        /* A billed malformed generation is retained and withheld. */
      }
    }
    return { payload: payloadOutput, costUsd, providerRequestId };
  };
  const cell = async (
    answer: RecoveryCase,
    arm: Arm,
    repetition: number,
    phase: 'SMOKE' | 'MEASUREMENT',
  ) => {
    const { dossier, instruction, sentences } = answer;
    const primary = await call(
      'primary',
      {
        rubric: RECOVERY_RUBRIC,
        dossier,
        instruction,
        sentences,
        ...(arm === 'SUPPLIED_EVIDENCE'
          ? { providedEvidence: reviewedRoles(plan, answer) }
          : {}),
      },
      phase,
      { caseId: answer.caseId, arm, repetition },
    );
    let extraction: unknown = primary.payload;
    let verification: unknown = null;
    let verificationInputHash: string | null = null;
    let costUsd = primary.costUsd;
    const providerRequestIds = [primary.providerRequestId];
    const parsed = recoveryExtractionSchema.safeParse(extraction);
    if (phase === 'SMOKE' && !parsed.success)
      throw new Error('RECOVERY_SMOKE_EXTRACTION_SCHEMA_INVALID');
    if (parsed.success && arm === 'SUPPLIED_EVIDENCE')
      extraction = suppliedExtraction(plan, answer, parsed.data);
    // Reviewed evidence can test the verifier even when the primary's grade is unusable.
    // The invalid proposal stays invalid; no owner grade is substituted for it.
    const verifierEvidence =
      arm === 'SUPPLIED_EVIDENCE'
        ? { criteria: reviewedRoles(plan, answer) }
        : parsed.success
          ? parsed.data
          : null;
    if (verifierEvidence) {
      const request = buildRecoveryVerificationInput({
        answer,
        extraction: verifierEvidence,
      });
      verificationInputHash = recoveryHash(request);
      const checked = await call('verifier', request, phase, {
        caseId: answer.caseId,
        arm,
        repetition,
      });
      verification = checked.payload;
      costUsd += checked.costUsd;
      providerRequestIds.push(checked.providerRequestId);
      if (
        phase === 'SMOKE' &&
        !recoveryVerificationSchema.safeParse(verification).success
      )
        throw new Error('RECOVERY_SMOKE_VERIFICATION_SCHEMA_INVALID');
    }
    if (phase === 'MEASUREMENT') {
      const observation = {
        arm,
        caseId: answer.caseId,
        repetition,
        extraction,
        verification,
        verificationInputHash,
        costUsd,
        providerRequestIds,
      };
      const delivered = deliverRecoveryCorrection({
        answer,
        extraction,
        verification,
      });
      input.persist({ kind: 'OBSERVATION', observation, delivered });
      plan.run.observations.push(observation);
    }
  };
  try {
    const smoke = [...plan.pack.cases].sort(
      (a, b) => JSON.stringify(b).length - JSON.stringify(a).length,
    )[0];
    if (!smoke) throw new Error('RECOVERY_EMPTY_PACK');
    await cell(smoke, 'EXTRACTED_EVIDENCE', 0, 'SMOKE');
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      const cases = [...plan.pack.cases].sort((a, b) =>
        recoveryHash([plan.run.packHash, repetition, a.caseId]).localeCompare(
          recoveryHash([plan.run.packHash, repetition, b.caseId]),
        ),
      );
      for (const answer of cases)
        for (const arm of arms)
          await cell(answer, arm, repetition, 'MEASUREMENT');
    }
  } catch (error) {
    stopped =
      error instanceof Error ? error.message : 'RECOVERY_EXECUTION_FAILED';
    input.persist({ kind: 'STOPPED', reason: stopped });
  }
  return {
    run: plan.run,
    stopped,
    attemptedCalls: sequence,
    responseAccounting,
    status: stopped
      ? 'INCOMPLETE_REVIEW_REQUIRED'
      : 'MEASUREMENT_COMPLETE_REVIEW_REQUIRED',
    safetyApplicability: plan.safetyApplicability,
  };
}
