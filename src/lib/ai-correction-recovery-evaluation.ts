import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  RECOVERY_RUBRIC,
  validateRecoveryPack,
  recoveryLockSchema,
  type RecoveryLock,
  recoveryReferenceSchema,
  recoveryExtractionSchema,
  type RecoveryPack,
  type RecoveryReference,
} from './ai-correction-recovery-contract';
import {
  buildRecoveryVerificationInput,
  deliverRecoveryCorrection,
} from './ai-correction-recovery-pipeline';

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new Error('Missing reviewed case or criterion.');
  return value;
}

export function recoveryHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, nested: unknown) => {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.fromEntries(
        Object.entries(nested).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    }
    return nested;
  });
  if (canonical === undefined) throw new Error('Cannot hash a non-JSON value.');
  return createHash('sha256').update(canonical).digest('hex');
}

export function validateRecoveryReference(
  rawPack: unknown,
  rawReference: unknown,
): {
  pack: RecoveryPack;
  reference: RecoveryReference;
  uncertain: Set<string>;
} {
  const pack = validateRecoveryPack(rawPack);
  const reference = recoveryReferenceSchema.parse(rawReference);
  if (pack.provenance !== 'OWNER_SUPPLIED')
    throw new Error('Synthetic drafts cannot qualify a pilot.');
  if (reference.packHash !== recoveryHash(pack))
    throw new Error('Reference does not match the sealed pack.');
  const cases = new Map(pack.cases.map((answer) => [answer.caseId, answer]));
  if (
    new Set(reference.labels.map((row) => row.caseId)).size !== 90 ||
    reference.labels.length !== 90
  ) {
    throw new Error('All 90 cases require exactly one reference row.');
  }
  const retestIds = new Set(pack.retestCaseIds);
  if (
    retestIds.size !== 10 ||
    new Set(pack.retestCaseIds.map((id) => cases.get(id)?.sourceAnswerId))
      .size !== 10 ||
    pack.retestCaseIds.some((id) => cases.get(id)?.variant !== 'BASELINE') ||
    reference.retest.some((row) => !retestIds.has(row.caseId)) ||
    new Set(reference.retest.map((row) => row.caseId)).size !== 10
  ) {
    throw new Error(
      'Blind retest must cover the ten preselected distinct originals.',
    );
  }
  const uncertain = new Set<string>();
  for (const row of [...reference.labels, ...reference.retest]) {
    const answer = cases.get(row.caseId);
    if (
      !answer ||
      new Set(row.criteria.map((criterion) => criterion.criterionKey)).size !==
        3
    ) {
      throw new Error('Unknown case or duplicate reference criterion.');
    }
    const sentenceIds = new Set(
      answer.sentences.map((sentence) => sentence.id),
    );
    for (const criterion of row.criteria) {
      const definition = required(
        RECOVERY_RUBRIC.criteria.find(
          (entry) => entry.key === criterion.criterionKey,
        ),
      );
      if (
        Object.entries(criterion.roles).some(
          ([role, ids]) =>
            !(definition.roles as readonly string[]).includes(role) ||
            ids.some((id) => !sentenceIds.has(id)),
        )
      )
        throw new Error(
          'Reference evidence has invalid roles or sentence identifiers.',
        );
      if (criterion.level === null)
        uncertain.add(`${answer.sourceAnswerId}:${criterion.criterionKey}`);
    }
  }
  for (const row of reference.retest) {
    const original = required(
      reference.labels.find((label) => label.caseId === row.caseId),
    );
    for (const criterion of row.criteria) {
      if (
        criterion.level !==
        required(
          original.criteria.find(
            (entry) => entry.criterionKey === criterion.criterionKey,
          ),
        ).level
      ) {
        uncertain.add(
          `${required(cases.get(row.caseId)).sourceAnswerId}:${criterion.criterionKey}`,
        );
      }
    }
  }
  return { pack, reference, uncertain };
}

/** The persisted lock binds the exact reviewed inputs; it is not an owner signature. */
export function createRecoveryLock(
  rawPack: unknown,
  rawReference: unknown,
  lockedAt: string,
): RecoveryLock {
  const { pack, reference, uncertain } = validateRecoveryReference(
    rawPack,
    rawReference,
  );
  const lock = recoveryLockSchema.parse({
    schemaVersion: 1,
    packHash: recoveryHash(pack),
    referenceHash: recoveryHash(reference),
    lockedAt,
    reviewer: reference.reviewer,
    uncertainSourceCriteria: [...uncertain].sort(),
    status: 'READY_FOR_BUDGETED_MEASUREMENT',
  });
  if (Date.parse(lock.lockedAt) < Date.parse(reference.reviewedAt))
    throw new Error('Reference lock cannot precede completed owner review.');
  return lock;
}

const recoveryObservationSchema = z
  .object({
    arm: z.enum(['SUPPLIED_EVIDENCE', 'EXTRACTED_EVIDENCE']),
    caseId: z.string(),
    repetition: z.number().int().min(1).max(3),
    extraction: z.unknown(),
    verification: z.unknown(),
    verificationInputHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    costUsd: z.number().nonnegative().nullable(),
    providerRequestIds: z.array(z.string().min(1)),
  })
  .strict();

const recoveryRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    packHash: z.string().regex(/^[a-f0-9]{64}$/u),
    referenceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    lockHash: z.string().regex(/^[a-f0-9]{64}$/u),
    referenceLockedAt: z.string().datetime(),
    startedAt: z.string().datetime(),
    candidate: z
      .object({
        primaryModel: z.string().min(1),
        verifierModel: z.string().min(1),
        promptHash: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict(),
    // A reference to the separate complete regression report, never an inline "all gates passed" boolean.
    safetyReportHash: z.string().regex(/^[a-f0-9]{64}$/u),
    observations: z.array(recoveryObservationSchema),
  })
  .strict();

type Observation = z.infer<typeof recoveryObservationSchema>;

/** Substitute reviewed evidence only. Never copy the reference grade into a model proposal. */
function recoveryExtractionForArm(
  pack: RecoveryPack,
  reference: RecoveryReference,
  observation: Observation,
) {
  const extraction = recoveryExtractionSchema.safeParse(observation.extraction);
  if (!extraction.success) return null;
  if (observation.arm === 'EXTRACTED_EVIDENCE') return extraction.data;
  if (!pack.cases.some((answer) => answer.caseId === observation.caseId))
    return null;
  const reviewed = required(
    reference.labels.find((row) => row.caseId === observation.caseId),
  );
  return {
    criteria: extraction.data.criteria.map((row) => ({
      ...row,
      roles: required(
        reviewed.criteria.find(
          (criterion) => criterion.criterionKey === row.criterionKey,
        ),
      ).roles,
    })),
  };
}

export function evaluateRecoveryPilot(
  rawPack: unknown,
  rawReference: unknown,
  rawLock: unknown,
  rawRun: unknown,
) {
  const { pack, reference, uncertain } = validateRecoveryReference(
    rawPack,
    rawReference,
  );
  const lock = recoveryLockSchema.parse(rawLock);
  const expectedLock = createRecoveryLock(pack, reference, lock.lockedAt);
  if (recoveryHash(lock) !== recoveryHash(expectedLock))
    throw new Error(
      'Lock artifact does not match the reviewed inputs and uncertainty.',
    );
  const run = recoveryRunSchema.parse(rawRun);
  if (
    run.packHash !== recoveryHash(pack) ||
    run.referenceHash !== recoveryHash(reference) ||
    run.lockHash !== recoveryHash(lock) ||
    run.referenceLockedAt !== lock.lockedAt
  )
    throw new Error('Run uses different locked inputs.');
  if (
    Date.parse(run.referenceLockedAt) < Date.parse(reference.reviewedAt) ||
    Date.parse(run.startedAt) <= Date.parse(run.referenceLockedAt)
  ) {
    throw new Error(
      'Labels and blind retest must be locked before the first measured output.',
    );
  }
  const keys = new Set<string>();
  const cases = new Map(pack.cases.map((answer) => [answer.caseId, answer]));
  const arms = (['SUPPLIED_EVIDENCE', 'EXTRACTED_EVIDENCE'] as const).map(
    (arm) => {
      let displayed = 0;
      let incorrect = 0;
      let structuralEvidenceChecksPassed = 0;
      let referenceEvidenceComplete = 0;
      let referenceEvidenceAssessable = 0;
      let knownCostUsd = 0;
      let unknownCostCount = 0;
      let unidentifiedVerificationCount = 0;
      const levels = new Map<string, (string | null)[]>();
      const groups = new Map<
        string,
        {
          sourceAnswerId: string;
          displayed: number;
          incorrect: number;
          total: number;
        }
      >();
      const rows = run.observations.filter((row) => row.arm === arm);
      for (const observation of rows) {
        const key = `${arm}:${observation.caseId}:${observation.repetition}`;
        const answer = cases.get(observation.caseId);
        if (!answer || keys.has(key))
          throw new Error('Duplicate or unknown observation.');
        keys.add(key);
        const extraction = recoveryExtractionForArm(
          pack,
          reference,
          observation,
        );
        const expectedHash = extraction
          ? recoveryHash(buildRecoveryVerificationInput({ answer, extraction }))
          : null;
        if (observation.verificationInputHash !== expectedHash)
          throw new Error(
            'Verifier response is not bound to the expected blinded evidence request.',
          );
        const delivered = deliverRecoveryCorrection({
          answer,
          extraction,
          verification: observation.verification,
        });
        const gold = required(
          reference.labels.find((row) => row.caseId === answer.caseId),
        );
        const group = groups.get(answer.sourceAnswerId) ?? {
          sourceAnswerId: answer.sourceAnswerId,
          displayed: 0,
          incorrect: 0,
          total: 0,
        };
        for (const criterion of delivered) {
          const referenceCriterion = required(
            gold.criteria.find(
              (row) => row.criterionKey === criterion.criterionKey,
            ),
          );
          const definition = required(
            RECOVERY_RUBRIC.criteria.find(
              (row) => row.key === criterion.criterionKey,
            ),
          );
          const evidenceAssessable = definition.roles.every(
            (role) => (referenceCriterion.roles[role]?.length ?? 0) > 0,
          );
          if (evidenceAssessable) {
            referenceEvidenceAssessable += 1;
            const extractedCriterion = extraction?.criteria.find(
              (row) => row.criterionKey === criterion.criterionKey,
            );
            if (
              definition.roles.every((role) =>
                referenceCriterion.roles[role].every((id) =>
                  extractedCriterion?.roles[role]?.includes(id),
                ),
              )
            ) {
              referenceEvidenceComplete += 1;
            }
          }
          const levelKey = `${answer.caseId}:${criterion.criterionKey}`;
          levels.set(levelKey, [
            ...(levels.get(levelKey) ?? []),
            criterion.level,
          ]);
          group.total += 1;
          if (
            criterion.reason !== 'EXTRACTION_INCOMPLETE' &&
            criterion.reason !== 'INVALID_OUTPUT'
          )
            structuralEvidenceChecksPassed += 1;
          if (criterion.level !== null) {
            displayed += 1;
            group.displayed += 1;
            const expected = required(
              gold.criteria.find(
                (row) => row.criterionKey === criterion.criterionKey,
              ),
            );
            if (
              uncertain.has(
                `${answer.sourceAnswerId}:${criterion.criterionKey}`,
              ) ||
              expected.level !== criterion.level
            ) {
              incorrect += 1;
              group.incorrect += 1;
            }
          }
        }
        groups.set(answer.sourceAnswerId, group);
        if (
          observation.verificationInputHash !== null &&
          observation.providerRequestIds.length === 0
        )
          unidentifiedVerificationCount += 1;
        if (observation.costUsd === null) unknownCostCount += 1;
        else knownCostUsd += observation.costUsd;
      }
      const total = 90 * 3 * 3;
      const complete = rows.length === 90 * 3;
      const usable = displayed - incorrect;
      return {
        arm,
        status:
          !complete || unknownCostCount || unidentifiedVerificationCount
            ? 'UNMEASURED'
            : incorrect === 0 && usable / total >= 0.7
              ? 'PASS'
              : 'BLOCKED',
        observations: rows.length,
        expectedObservations: 270,
        totalCriteria: total,
        displayed,
        incorrect,
        usable,
        coverage: usable / total,
        abstentions: total - displayed,
        // Structural delivery checks only, not recall of all evidence in the reference.
        structuralEvidenceChecksPassed,
        structuralEvidenceCheckRate: structuralEvidenceChecksPassed / total,
        referenceEvidenceComplete,
        referenceEvidenceAssessable,
        referenceEvidenceCompleteness:
          referenceEvidenceAssessable === 0
            ? null
            : referenceEvidenceComplete / referenceEvidenceAssessable,
        referenceEvidenceScope:
          'Recall of all owner-selected sentence-role bindings; equivalent unselected evidence may be valid and requires review. Empty reference role sets are unmeasured.',
        unstableCriteria: [...levels.values()].filter(
          (values) => new Set(values).size > 1,
        ).length,
        knownCostUsd,
        unknownCostCount,
        unidentifiedVerificationCount,
        sourceGroups: [...groups.values()],
      };
    },
  );
  return {
    policyVersion: 'closed-writing-pilot/1.0.0',
    status: arms.every((arm) => arm.status === 'PASS')
      ? 'SAFETY_AND_RELEASE_REVIEW_REQUIRED'
      : 'BLOCKED',
    referenceKind: 'OWNER_REVIEWED_NOT_INDEPENDENT_HUMAN_VALIDATION',
    lockHash: recoveryHash(lock),
    uncertainSourceCriteria: [...uncertain].sort(),
    candidate: run.candidate,
    safetyReportHash: run.safetyReportHash,
    arms,
    note: 'Observed owner-reference agreement is not proof of population-level reliability. Safety evidence, deployment checks and owner GO remain separate gates.',
  };
}
