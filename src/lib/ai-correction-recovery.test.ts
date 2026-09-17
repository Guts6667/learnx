import { describe, expect, it, vi } from 'vitest';
import {
  RECOVERY_RUBRIC,
  type RecoveryExtraction,
  type RecoveryReference,
  type RecoverySource,
} from './ai-correction-recovery-contract';
import {
  prepareRecoveryPack,
  recoveryBlindReview,
} from './ai-correction-recovery-pack';
import {
  buildRecoveryVerificationInput,
  deliverRecoveryCorrection,
  runRecoveryCorrection,
} from './ai-correction-recovery-pipeline';
import {
  evaluateRecoveryPilot,
  createRecoveryLock,
  recoveryHash,
  validateRecoveryReference,
} from './ai-correction-recovery-evaluation';

function fixtures() {
  // Synthetic fixtures demonstrate instrument behavior, never empirical pilot quality.
  const sources: RecoverySource[] = Array.from({ length: 30 }, (_, index) => ({
    sourceAnswerId: `source-${index}`,
    provenance: `instrument fixture ${index}`,
    dossier:
      'Conditions contrôlées. Résultat local uniquement. Généralisation inconnue.',
    instruction: 'Expliquer le résultat et sa limite.',
    sentences: [
      { id: 's1', text: `Fait ${index}; mécanisme et limite explicités.` },
    ],
    mutations: [
      {
        kind: 'FACT_INVERSION',
        targetCriterion: 'source-fidelity',
        description: 'Inversion.',
        sentences: [{ id: 's1', text: `Inverse ${index}.` }],
      },
      {
        kind: 'EVIDENCE_DELETION',
        targetCriterion: 'mechanism-link',
        description: 'Suppression.',
        sentences: [{ id: 's1', text: `Reste ${index}.` }],
      },
    ],
  }));
  const pack = prepareRecoveryPack(sources, 'OWNER_SUPPLIED');
  const extraction: RecoveryExtraction = {
    criteria: RECOVERY_RUBRIC.criteria.map((criterion) => ({
      criterionKey: criterion.key,
      proposedLevel: 'mastered',
      roles: Object.fromEntries(criterion.roles.map((role) => [role, ['s1']])),
    })),
  };
  const verification = {
    criteria: RECOVERY_RUBRIC.criteria.map((criterion) => ({
      criterionKey: criterion.key,
      requirements: ['SATISFIED', 'SATISFIED', 'SATISFIED'],
      completeEvidence: true,
    })),
  };
  const labels = pack.cases.map((answer) => ({
    caseId: answer.caseId,
    criteria: extraction.criteria.map(({ proposedLevel, ...row }) => ({
      ...row,
      level: proposedLevel,
    })),
  }));
  const reference: RecoveryReference = {
    schemaVersion: 1,
    rubricVersion: RECOVERY_RUBRIC.version,
    packHash: recoveryHash(pack),
    reviewer: 'Rayan',
    reviewedAt: '2026-09-17T10:00:00.000Z',
    rubricApproved: true,
    independentSourcesConfirmed: true,
    labelsLockedBeforeModelOutputs: true,
    labels,
    retest: pack.retestCaseIds.map((id) => {
      const row = labels.find((entry) => entry.caseId === id);
      if (!row) throw new Error('Missing retest fixture');
      return structuredClone(row);
    }),
  };
  const lock = createRecoveryLock(pack, reference, '2026-09-17T11:00:00.000Z');
  const run = {
    schemaVersion: 1,
    packHash: recoveryHash(pack),
    referenceHash: recoveryHash(reference),
    lockHash: recoveryHash(lock),
    referenceLockedAt: '2026-09-17T11:00:00.000Z',
    startedAt: '2026-09-17T12:00:00.000Z',
    candidate: {
      primaryModel: 'fixture-primary',
      verifierModel: 'fixture-checker',
      promptHash: 'a'.repeat(64),
    },
    safetyReportHash: 'b'.repeat(64),
    observations: (
      ['SUPPLIED_EVIDENCE', 'EXTRACTED_EVIDENCE'] as const
    ).flatMap((arm) =>
      pack.cases.flatMap((answer) =>
        [1, 2, 3].map((repetition) => ({
          arm,
          caseId: answer.caseId,
          repetition,
          extraction: structuredClone(extraction),
          verification: structuredClone(verification),
          verificationInputHash: recoveryHash(
            buildRecoveryVerificationInput({ answer, extraction }),
          ),
          costUsd: 0.001 as number | null,
          providerRequestIds: ['fixture-request'],
        })),
      ),
    ),
  };
  return {
    sources,
    pack,
    reference,
    lock,
    run,
    extraction,
    verification,
    answer: pack.cases[0],
  };
}

describe('recovery evidence isolation', () => {
  it('cannot smuggle proposed grades through extractor-controlled role keys or sentence references', async () => {
    const { answer, extraction, verification } = fixtures();
    extraction.criteria[0].roles = {
      proposedLevel_mastered: ['expected grade mastered'],
      claim: ['s1', 'grade_mastered'],
    };
    const verify = vi.fn().mockResolvedValue(verification);
    const delivered = await runRecoveryCorrection({
      answer,
      extract: vi.fn().mockResolvedValue(extraction),
      verify,
    });
    expect(JSON.stringify(verify.mock.calls[0][0])).not.toMatch(
      /proposedLevel_mastered|expected grade mastered|grade_mastered/,
    );
    expect(delivered[0].level).toBeNull();
  });
  it('blinds grades, rationale, cluster and mutation metadata while preserving dossier and full answer context', async () => {
    const { answer, extraction, verification } = fixtures();
    const verify = vi.fn().mockResolvedValue(verification);
    const delivered = await runRecoveryCorrection({
      answer,
      extract: vi.fn().mockResolvedValue(extraction),
      verify,
    });
    expect(delivered.every((row) => row.level === 'mastered')).toBe(true);
    const input = verify.mock.calls[0][0];
    expect(input.dossier).toBe(answer.dossier);
    expect(input.sentences).toEqual(answer.sentences);
    expect(JSON.stringify(input)).not.toMatch(
      /proposedLevel|sourceAnswerId|BASELINE|FACT_INVERSION|EVIDENCE_DELETION/,
    );
  });

  it('withholds extraction misses, invalid sentence references, checker uncertainty and conflicting levels', () => {
    const { answer, extraction, verification } = fixtures();
    extraction.criteria[0].roles = { claim: ['not-in-answer'] };
    verification.criteria[1].requirements[0] = 'UNCERTAIN';
    verification.criteria[2].requirements[0] = 'NOT_SATISFIED';
    expect(
      deliverRecoveryCorrection({ answer, extraction, verification }).map(
        (row) => row.reason,
      ),
    ).toEqual(['EXTRACTION_INCOMPLETE', 'UNCERTAIN', 'LEVEL_DISAGREEMENT']);
  });

  it('rejects duplicate criterion keys instead of last-write-wins', () => {
    const { answer, extraction, verification } = fixtures();
    verification.criteria.push(verification.criteria[0]);
    expect(
      deliverRecoveryCorrection({ answer, extraction, verification }).every(
        (row) => row.level === null,
      ),
    ).toBe(true);
  });

  it('does not call the verifier for malformed extraction and keeps proposed grades out of supplied evidence verification', async () => {
    const { answer, extraction, verification } = fixtures();
    const verify = vi.fn().mockResolvedValue(verification);
    await runRecoveryCorrection({
      answer,
      extract: vi.fn().mockResolvedValue({ surprise: true }),
      verify,
    });
    expect(verify).not.toHaveBeenCalled();
    const extract = vi.fn();
    await runRecoveryCorrection({
      answer,
      suppliedExtraction: extraction,
      extract,
      verify,
    });
    expect(extract).not.toHaveBeenCalled();
    expect(verify).toHaveBeenCalledOnce();
  });
});

describe('closed pilot qualification instrument', () => {
  it('measures the supplied-evidence verifier despite an invalid primary extraction, while withholding learner grades', () => {
    const { pack, reference, lock, run } = fixtures();
    const imported: unknown = {
      ...run,
      observations: run.observations.map((row, index) =>
        index === 0 ? { ...row, extraction: null } : row,
      ),
    };
    const report = evaluateRecoveryPilot(pack, reference, lock, imported);
    expect(report.arms[0].displayed).toBe(807);
    expect(report.arms[0].verifierBeforePrimaryAgreement.graded).toBe(810);
    expect(report.arms[0].verifierBeforePrimaryAgreement.incorrect).toBe(0);
  });
  it('reports standalone verifier errors even when grade disagreement prevents display', () => {
    const { pack, reference, lock, run } = fixtures();
    run.observations[0].verification.criteria[0].requirements = [
      'NOT_SATISFIED',
      'NOT_SATISFIED',
      'NOT_SATISFIED',
    ];
    const report = evaluateRecoveryPilot(pack, reference, lock, run);
    expect(report.arms[0].incorrect).toBe(0);
    expect(report.arms[0].verifierBeforePrimaryAgreement.incorrect).toBe(1);
    expect(report.arms[0].referenceEvidenceCompleteness).toBe(1);
  });
  it('lets a deliberately correct synthetic instrument fixture pass the numerical gates without authorizing release', () => {
    const { pack, reference, lock, run } = fixtures();
    const report = evaluateRecoveryPilot(pack, reference, lock, run);
    expect(report.status).toBe('SAFETY_AND_RELEASE_REVIEW_REQUIRED');
    expect(
      report.arms.map((arm) => [
        arm.status,
        arm.totalCriteria,
        arm.sourceGroups.length,
      ]),
    ).toEqual([
      ['PASS', 810, 30],
      ['PASS', 810, 30],
    ]);
  });

  it('counts a retest disagreement as uncertainty for that source criterion, retaining all denominators', () => {
    const { pack, reference, lock, run } = fixtures();
    reference.retest[0].criteria[0].level = 'partial';
    Object.assign(lock, createRecoveryLock(pack, reference, lock.lockedAt));
    run.referenceHash = recoveryHash(reference);
    run.lockHash = recoveryHash(lock);
    const report = evaluateRecoveryPilot(pack, reference, lock, run);
    expect(report.uncertainSourceCriteria).toHaveLength(1);
    expect(report.arms[0]).toMatchObject({
      status: 'BLOCKED',
      totalCriteria: 810,
      incorrect: 0,
      uncertainDisplayed: 9,
    });
  });

  it('fails on any incorrect displayed level and includes missing runs in the expected denominator', () => {
    const { pack, reference, lock, run } = fixtures();
    reference.labels[0].criteria[0].level = 'partial';
    Object.assign(lock, createRecoveryLock(pack, reference, lock.lockedAt));
    run.referenceHash = recoveryHash(reference);
    run.lockHash = recoveryHash(lock);
    expect(
      evaluateRecoveryPilot(pack, reference, lock, run).arms[0].incorrect,
    ).toBeGreaterThan(0);
    run.observations.pop();
    expect(
      evaluateRecoveryPilot(pack, reference, lock, run).arms[1],
    ).toMatchObject({
      status: 'UNMEASURED',
      totalCriteria: 810,
    });
  });

  it('does not count unknown costs as free, reuse a mismatched request, or accept repeated observations', () => {
    const { pack, reference, lock, run } = fixtures();
    run.observations[0].costUsd = null;
    expect(
      evaluateRecoveryPilot(pack, reference, lock, run).arms[0].status,
    ).toBe('UNMEASURED');
    run.observations[0].verificationInputHash = 'c'.repeat(64);
    expect(() => evaluateRecoveryPilot(pack, reference, lock, run)).toThrow(
      'bound',
    );
    run.observations[0].verificationInputHash = recoveryHash(
      buildRecoveryVerificationInput({
        answer: pack.cases[0],
        extraction: run.observations[0].extraction,
      }),
    );
    run.observations.push(run.observations[0]);
    expect(() => evaluateRecoveryPilot(pack, reference, lock, run)).toThrow(
      'Duplicate',
    );
  });

  it('rejects late labels, mismatched packs, synthetic drafts, unknown reference evidence and missing source independence', () => {
    const { pack, reference, lock, run } = fixtures();
    run.startedAt = reference.reviewedAt;
    expect(() => evaluateRecoveryPilot(pack, reference, lock, run)).toThrow(
      'locked',
    );
    expect(() =>
      validateRecoveryReference(
        { ...pack, provenance: 'SYNTHETIC_DRAFT' },
        reference,
      ),
    ).toThrow('Synthetic');
    expect(() =>
      validateRecoveryReference(pack, {
        ...reference,
        packHash: 'c'.repeat(64),
      }),
    ).toThrow('sealed');
    reference.labels[0].criteria[0].roles.claim = ['missing'];
    expect(() => validateRecoveryReference(pack, reference)).toThrow(
      'identifiers',
    );
    expect(() =>
      validateRecoveryReference(pack, {
        ...reference,
        independentSourcesConfirmed: false,
      }),
    ).toThrow();
  });

  it('rejects duplicate originals and prevents source grouping from leaking into review material', () => {
    const { sources, pack } = fixtures();
    expect(recoveryBlindReview(pack).cases).toHaveLength(90);
    expect(recoveryBlindReview(pack, true).cases).toHaveLength(10);
    expect(JSON.stringify(recoveryBlindReview(pack))).not.toContain(
      'sourceAnswerId',
    );
    sources[1].sentences = sources[0].sentences;
    expect(() => prepareRecoveryPack(sources, 'OWNER_SUPPLIED')).toThrow(
      'Duplicated original',
    );
  });
});

describe('recovery pack and lock import boundaries', () => {
  it('consumes the actual lock and rejects absent, stale and altered lock evidence', () => {
    const { pack, reference, lock, run } = fixtures();
    expect(() =>
      evaluateRecoveryPilot(pack, reference, undefined, run),
    ).toThrow();
    expect(() =>
      evaluateRecoveryPilot(
        pack,
        reference,
        { ...lock, packHash: 'd'.repeat(64) },
        run,
      ),
    ).toThrow('Lock artifact');
    expect(() =>
      evaluateRecoveryPilot(pack, reference, lock, {
        ...run,
        lockHash: 'd'.repeat(64),
      }),
    ).toThrow('locked inputs');
    expect(() =>
      evaluateRecoveryPilot(pack, reference, lock, {
        ...run,
        referenceLockedAt: '2026-09-17T11:01:00.000Z',
      }),
    ).toThrow('locked inputs');
    expect(() =>
      createRecoveryLock(pack, reference, '2026-09-17T09:59:00.000Z'),
    ).toThrow('precede');
  });

  it('revalidates imported pack content instead of trusting preparation', () => {
    const { pack, reference } = fixtures();
    const originals = pack.cases.filter(
      (answer) => answer.variant === 'BASELINE',
    );
    originals[1].sentences = originals[0].sentences.map((row) => ({
      id: 'renamed',
      text: `  ${row.text}  `,
    }));
    reference.packHash = recoveryHash(pack);
    expect(() => validateRecoveryReference(pack, reference)).toThrow(
      'Duplicated original',
    );
  });

  it('rejects no-op mutations even with changed sentence identifiers at prepare and lock', () => {
    const { sources, pack, reference } = fixtures();
    sources[0].mutations[0].sentences = sources[0].sentences.map((row) => ({
      ...row,
      id: 'new-id',
    }));
    expect(() => prepareRecoveryPack(sources, 'OWNER_SUPPLIED')).toThrow(
      'must change',
    );
    const original = pack.cases.find((answer) => answer.variant === 'BASELINE');
    if (!original) throw new Error('Fixture missing original');
    const mutation = pack.cases.find(
      (answer) =>
        answer.sourceAnswerId === original.sourceAnswerId &&
        answer.variant === 'FACT_INVERSION',
    );
    if (!mutation) throw new Error('Fixture missing mutation');
    mutation.sentences = original.sentences.map((row) => ({
      ...row,
      id: 'new-id',
    }));
    reference.packHash = recoveryHash(pack);
    expect(() => validateRecoveryReference(pack, reference)).toThrow(
      'must change',
    );
  });

  it('keeps unidentified verifier calls unmeasured without inventing request IDs', () => {
    const { pack, reference, lock, run } = fixtures();
    run.observations[0].providerRequestIds = [];
    const report = evaluateRecoveryPilot(pack, reference, lock, run);
    expect(report.arms[0]).toMatchObject({
      status: 'UNMEASURED',
      unidentifiedVerificationCount: 1,
      structuralEvidenceChecksPassed: 810,
    });
    expect(report.arms[0]).not.toHaveProperty('extractionCompleteness');
  });
});
