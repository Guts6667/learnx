import {
  RECOVERY_RUBRIC,
  recoverySourceSchema,
  validateRecoveryPack,
  type RecoveryPack,
} from './ai-correction-recovery-contract';
import { recoveryHash } from './ai-correction-recovery-evaluation';

/** Creates candidate material only; no reference level is generated or implied. */
export function prepareRecoveryPack(
  rawSources: unknown[],
  provenance: RecoveryPack['provenance'],
): RecoveryPack {
  const sources = rawSources.map((source) =>
    recoverySourceSchema.parse(source),
  );
  if (
    sources.length !== 30 ||
    new Set(sources.map((source) => source.sourceAnswerId)).size !== 30
  ) {
    throw new Error(
      'Supply exactly 30 independent, uniquely identified source answers.',
    );
  }
  const cases: RecoveryPack['cases'] = sources
    .flatMap((source) => {
      if (new Set(source.mutations.map((mutation) => mutation.kind)).size !== 2)
        throw new Error('Each source needs one inversion and one deletion.');
      return [
        { kind: 'BASELINE' as const, sentences: source.sentences },
        ...source.mutations,
      ].map((variant) => {
        if (
          new Set(variant.sentences.map((sentence) => sentence.id)).size !==
          variant.sentences.length
        ) {
          throw new Error('Duplicate sentence identifiers.');
        }
        return {
          caseId: recoveryHash({
            source: source.sourceAnswerId,
            kind: variant.kind,
          }).slice(0, 16),
          sourceAnswerId: source.sourceAnswerId,
          variant: variant.kind,
          dossier: source.dossier,
          instruction: source.instruction,
          sentences: variant.sentences,
        };
      });
    })
    .sort((left, right) => left.caseId.localeCompare(right.caseId));
  return validateRecoveryPack({
    schemaVersion: 1,
    rubricVersion: RECOVERY_RUBRIC.version,
    provenance,
    cases,
    retestCaseIds: cases
      .filter((answer) => answer.variant === 'BASELINE')
      .slice(0, 10)
      .map((answer) => answer.caseId),
  });
}

export function createBlankRecoveryReference(pack: RecoveryPack) {
  const row = (caseId: string) => ({
    caseId,
    criteria: RECOVERY_RUBRIC.criteria.map((criterion) => ({
      criterionKey: criterion.key,
      // REVIEW_REQUIRED is deliberately invalid: blank labels cannot masquerade as owner abstentions.
      level: 'REVIEW_REQUIRED',
      roles: Object.fromEntries(criterion.roles.map((role) => [role, []])),
    })),
  });
  return {
    schemaVersion: 1,
    rubricVersion: RECOVERY_RUBRIC.version,
    packHash: recoveryHash(pack),
    reviewer: 'Rayan',
    reviewedAt: '',
    rubricApproved: false,
    independentSourcesConfirmed: false,
    labelsLockedBeforeModelOutputs: false,
    labels: pack.cases.map((answer) => row(answer.caseId)),
    retest: pack.retestCaseIds.map(row),
  };
}

/** Public review material omits source grouping, mutation identity and expected levels. */
export function recoveryBlindReview(pack: RecoveryPack, retest = false) {
  const selected = retest
    ? pack.retestCaseIds
        .map((id) => {
          const answer = pack.cases.find((entry) => entry.caseId === id);
          if (!answer) throw new Error('Unknown retest case.');
          return answer;
        })
        .reverse()
    : pack.cases;
  return {
    rubric: RECOVERY_RUBRIC,
    cases: selected.map(({ caseId, dossier, instruction, sentences }) => ({
      caseId,
      dossier,
      instruction,
      sentences,
    })),
  };
}
