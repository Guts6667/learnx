import {
  RECOVERY_RUBRIC,
  recoveryExtractionSchema,
  recoveryVerificationSchema,
  type RecoveryCase,
  type RecoveryCriterionKey,
  type RecoveryExtraction,
  type RecoveryLevel,
} from './ai-correction-recovery-contract';

export interface RecoveryDeliveredCriterion {
  criterionKey: RecoveryCriterionKey;
  level: RecoveryLevel | null;
  reason:
    | 'VERIFIED'
    | 'EXTRACTION_INCOMPLETE'
    | 'INVALID_OUTPUT'
    | 'UNCERTAIN'
    | 'LEVEL_DISAGREEMENT';
}

/** No proposed level, model rationale, pair label, or mutation metadata. */
export function buildRecoveryVerificationInput(input: {
  answer: RecoveryCase;
  extraction: RecoveryExtraction;
}) {
  return {
    rubricVersion: RECOVERY_RUBRIC.version,
    dossier: input.answer.dossier,
    instruction: input.answer.instruction,
    sentences: input.answer.sentences,
    criteria: RECOVERY_RUBRIC.criteria.map((criterion) => ({
      criterionKey: criterion.key,
      requirements: criterion.requirements,
      roles: Object.fromEntries(
        criterion.roles.map((role) => {
          const row = input.extraction.criteria.find(
            (entry) => entry.criterionKey === criterion.key,
          );
          const validIds = new Set(
            input.answer.sentences.map((sentence) => sentence.id),
          );
          return [
            role,
            [
              ...new Set(
                (row?.roles[role] ?? []).filter((id) => validIds.has(id)),
              ),
            ],
          ];
        }),
      ),
    })),
  };
}

function hasUniqueCriteria(rows: { criterionKey: string }[]): boolean {
  return new Set(rows.map((row) => row.criterionKey)).size === rows.length;
}

function hasCompleteRoles(
  answer: RecoveryCase,
  extraction: RecoveryExtraction,
  key: RecoveryCriterionKey,
): boolean {
  const row = extraction.criteria.find(
    (criterion) => criterion.criterionKey === key,
  );
  const definition = RECOVERY_RUBRIC.criteria.find(
    (criterion) => criterion.key === key,
  );
  if (!row || !definition) return false;
  const validIds = new Set(answer.sentences.map((sentence) => sentence.id));
  return (
    definition.roles.every((role) => (row.roles[role]?.length ?? 0) > 0) &&
    Object.entries(row.roles).every(
      ([role, ids]) =>
        (definition.roles as readonly string[]).includes(role) &&
        ids.every((id) => validIds.has(id)),
    )
  );
}

/** The engine checks bounds/provenance; the verifier's semantics remain fallible. */
export function deliverRecoveryCorrection(input: {
  answer: RecoveryCase;
  extraction: unknown;
  verification: unknown;
}): RecoveryDeliveredCriterion[] {
  const extracted = recoveryExtractionSchema.safeParse(input.extraction);
  const verified = recoveryVerificationSchema.safeParse(input.verification);
  const invalid =
    !extracted.success ||
    !verified.success ||
    !hasUniqueCriteria(extracted.data.criteria) ||
    !hasUniqueCriteria(verified.data.criteria);
  return RECOVERY_RUBRIC.criteria.map(({ key }) => {
    const withheld = (
      reason: RecoveryDeliveredCriterion['reason'],
    ): RecoveryDeliveredCriterion => ({
      criterionKey: key,
      level: null,
      reason,
    });
    if (invalid || !extracted.success || !verified.success)
      return withheld('INVALID_OUTPUT');
    if (!hasCompleteRoles(input.answer, extracted.data, key))
      return withheld('EXTRACTION_INCOMPLETE');
    const check = verified.data.criteria.find(
      (criterion) => criterion.criterionKey === key,
    );
    if (!check?.completeEvidence || check.requirements.includes('UNCERTAIN'))
      return withheld('UNCERTAIN');
    const count = check.requirements.filter(
      (value) => value === 'SATISFIED',
    ).length;
    const computed: RecoveryLevel = check.requirements.includes('CONTRADICTED')
      ? 'insufficient'
      : (['insufficient', 'limited', 'partial', 'mastered'] as const)[count];
    const proposed = extracted.data.criteria.find(
      (criterion) => criterion.criterionKey === key,
    )?.proposedLevel;
    if (proposed !== computed) return withheld('LEVEL_DISAGREEMENT');
    return { criterionKey: key, level: computed, reason: 'VERIFIED' };
  });
}

/** Supplied-evidence and extraction arms use identical verification/delivery code. */
export async function runRecoveryCorrection(input: {
  answer: RecoveryCase;
  suppliedExtraction?: RecoveryExtraction;
  extract: (
    answer: Pick<RecoveryCase, 'dossier' | 'instruction' | 'sentences'>,
  ) => Promise<unknown>;
  verify: (
    request: ReturnType<typeof buildRecoveryVerificationInput>,
  ) => Promise<unknown>;
}): Promise<RecoveryDeliveredCriterion[]> {
  const { dossier, instruction, sentences } = input.answer;
  const extraction =
    input.suppliedExtraction ??
    (await input.extract({ dossier, instruction, sentences }));
  const parsed = recoveryExtractionSchema.safeParse(extraction);
  if (!parsed.success || !hasUniqueCriteria(parsed.data.criteria)) {
    return deliverRecoveryCorrection({
      answer: input.answer,
      extraction,
      verification: null,
    });
  }
  const verification = await input.verify(
    buildRecoveryVerificationInput({
      answer: input.answer,
      extraction: parsed.data,
    }),
  );
  return deliverRecoveryCorrection({
    answer: input.answer,
    extraction,
    verification,
  });
}
