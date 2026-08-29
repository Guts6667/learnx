import { vi } from 'vitest';

import {
  correctionContractSchema,
  type CorrectionContract,
  type Protocol3CorrectionArtifactOutput,
} from '../../lib/ai-correction-contracts';
import type { CheckerVerdict } from './correction-checker';
import {
  buildCorrectionOutcome,
  failedCorrection,
  withStoredConfidence,
  type StoredCorrection,
} from './correction-outcome';
import {
  buildHarness,
  buildQuote,
  contractRaw,
  strictOutput,
} from './correction-orchestration.test-support';

const contract: CorrectionContract =
  correctionContractSchema.parse(contractRaw);

/** A contract whose family sits outside the scientifically validated scope. */
const practiceContract: CorrectionContract = correctionContractSchema.parse({
  ...contractRaw,
  target: { ...contractRaw.target, activityType: 'practice' },
});

type Criterion = Protocol3CorrectionArtifactOutput['criteria'][number];

function foundCriterion(overrides: Partial<Criterion> = {}): Criterion {
  return {
    criterionKey: 'decision-position',
    // The model's self-report. Present in the artifact, never read by the
    // confidence derivation — see the guard test at the bottom of this file.
    confidence: 0.95,
    evidenceQuotes: ['Je retiens l’option locale.'],
    evidenceStatus: 'FOUND',
    feedback: 'La décision est explicite.',
    levelKey: 'mastered',
    ...overrides,
  } as Criterion;
}

function output(
  criteria: Criterion[] = [foundCriterion()],
): Protocol3CorrectionArtifactOutput {
  return {
    contractKey: contract.contractKey,
    contractVersion: contract.version,
    criteria,
    overallConfidence: 0.95,
    overallFeedback: 'Note claire.',
    secondPass: { reasons: [], required: false },
  };
}

function build(
  criteria: Criterion[],
  options: {
    contract?: CorrectionContract;
    unsureCriteria?: string[];
    /** Defaults to the checker agreeing on every delivered criterion. */
    verdicts?: Record<string, CheckerVerdict>;
  } = {},
) {
  return buildCorrectionOutcome({
    contract: options.contract ?? contract,
    output: output(criteria),
    unsureCriteria: options.unsureCriteria ?? [],
    usageCost: 0.01,
    verdicts:
      options.verdicts ??
      Object.fromEntries(
        criteria.map((item) => [item.criterionKey, 'AGREED' as const]),
      ),
  });
}

describe('buildCorrectionOutcome — confiance exposée', () => {
  it('étiquette chaque critère livré', () => {
    const outcome = build([foundCriterion()]);
    expect(outcome.criteria).toHaveLength(1);
    expect(outcome.criteria[0]?.confidence).toBe('HIGH');
  });

  it('atteint HIGH quand le vérificateur confirme un niveau extrême', () => {
    const outcome = build([foundCriterion({ levelKey: 'mastered' })]);
    expect(outcome.criteria[0]?.confidence).toBe('HIGH');
    expect(outcome.overallConfidence).toBe('HIGH');
  });

  it('plafonne à MEDIUM quand le vérificateur n’a pas répondu', () => {
    const outcome = build([foundCriterion({ levelKey: 'mastered' })], {
      verdicts: {},
    });
    expect(outcome.criteria[0]?.confidence).toBe('MEDIUM');
    expect(outcome.monitoringSignals).toContain('CHECKER_UNAVAILABLE');
  });

  it('déclasse en LOW un critère que le vérificateur contredit', () => {
    const outcome = build([foundCriterion({ levelKey: 'mastered' })], {
      verdicts: { 'decision-position': 'DISAGREED' },
    });
    expect(outcome.criteria[0]?.confidence).toBe('LOW');
    expect(outcome.indicativeScore).toBeNull();
    expect(outcome.monitoringSignals).toContain('CHECKER_DISAGREED');
  });

  it('retient le critère le plus faible pour la correction entière', () => {
    const outcome = build([
      foundCriterion(),
      foundCriterion({
        criterionKey: 'evidence-selection',
        evidenceQuotes: [],
        evidenceStatus: 'NO_RELEVANT_EVIDENCE',
        levelKey: 'mastered',
      }),
    ]);
    expect(outcome.criteria[1]?.confidence).toBe('LOW');
    expect(outcome.overallConfidence).toBe('LOW');
  });

  it('déclasse une correction dont un critère est à retravailler', () => {
    // An unsure criterion never reaches `criteria`, so the correction-wide
    // label would otherwise be computed as if it did not exist.
    const outcome = build([foundCriterion()], {
      unsureCriteria: ['evidence-selection'],
    });
    expect(outcome.overallConfidence).toBe('LOW');
  });

  it('marque une correction échouée LOW', () => {
    expect(failedCorrection(0.01).overallConfidence).toBe('LOW');
  });
});

describe('buildCorrectionOutcome — score indicatif', () => {
  it('publie le score quand aucun critère n’est LOW', () => {
    const outcome = build([
      foundCriterion({ levelKey: 'partial' }),
      foundCriterion({
        criterionKey: 'evidence-selection',
        levelKey: 'partial',
      }),
    ]);
    expect(outcome.indicativeScore).toBe(50);
  });

  it('retire le score dès qu’un critère est LOW', () => {
    // Same levels, so the same weighted 50 — withheld only because one
    // criterion claims no relevant evidence while grading above the floor.
    const outcome = build([
      foundCriterion({ levelKey: 'partial' }),
      foundCriterion({
        criterionKey: 'evidence-selection',
        evidenceQuotes: [],
        evidenceStatus: 'NO_RELEVANT_EVIDENCE',
        levelKey: 'partial',
      }),
    ]);
    expect(outcome.indicativeScore).toBeNull();
    expect(outcome.overallConfidence).toBe('LOW');
  });

  it('retire le score quand la contrainte dure contredit le niveau', () => {
    const outcome = build([
      foundCriterion({
        feedback: 'La contrainte de format est violée.',
        levelKey: 'mastered',
      }),
      // `mastered` on both, so the weighted total is 100 and sits well clear of
      // the score guard band. The score is withheld by the confidence rule
      // alone, not by the guard.
      foundCriterion({
        criterionKey: 'evidence-selection',
        levelKey: 'mastered',
      }),
    ]);
    expect(outcome.criteria[0]?.confidence).toBe('LOW');
    expect(outcome.secondPassRequired).toBe(false);
    expect(outcome.indicativeScore).toBeNull();
    expect(outcome.monitoringSignals).toContain(
      'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED',
    );
  });

  it('ne signale pas de contrainte dure au niveau plancher', () => {
    // Naming a violation while grading at the floor is coherent, not a
    // contradiction. This preserves the monitoring signal's original rule.
    const outcome = build([
      foundCriterion({
        feedback: 'La contrainte de format est violée.',
        levelKey: 'insufficient',
      }),
    ]);
    expect(outcome.monitoringSignals).not.toContain(
      'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED',
    );
    expect(outcome.criteria[0]?.confidence).toBe('HIGH');
  });
});

describe('buildCorrectionOutcome — périmètre scientifique', () => {
  it('résout la famille depuis le contrat, pas depuis un enregistrement', () => {
    // The contract stores the family lowercase, exactly as the promoted
    // identity scopes it. Reading it from anywhere that stores `WRITING`
    // instead returns "not validated" for the one family that is — the bug
    // this ticket already hit once, in the eligibility endpoint.
    expect(contract.target.activityType).toBe('writing');
    expect(practiceContract.target.activityType).toBe('practice');
  });

  it('sépare les familles maintenant que le vérificateur répond', () => {
    // Written in V4.5-110 as a tripwire while the UNAVAILABLE ceiling made the
    // two families indistinguishable. The checker lifts that ceiling, so the
    // family gate is finally the thing deciding, and it decides.
    const mastered = [foundCriterion({ levelKey: 'mastered' })];
    expect(build(mastered).overallConfidence).toBe('HIGH');
    expect(
      build(mastered, { contract: practiceContract }).overallConfidence,
    ).toBe('MEDIUM');
  });
});

describe('withStoredConfidence', () => {
  it('résout une correction stockée avant V4.5-110 en LOW', () => {
    const stored = {
      ...failedCorrection(0.01),
      criteria: [
        {
          key: 'decision-position',
          label: 'Position décisionnelle',
          weight: 60,
          levelKey: 'mastered',
          levelLabel: 'Maîtrisé',
          evidenceStatus: 'FOUND' as const,
          evidenceQuotes: ['Je retiens l’option locale.'],
          feedback: 'La décision est explicite.',
        },
      ],
      overallConfidence: undefined,
    } satisfies StoredCorrection;

    const resolved = withStoredConfidence(stored);
    expect(resolved.criteria[0]?.confidence).toBe('LOW');
    expect(resolved.overallConfidence).toBe('LOW');
  });

  it('laisse intacte une correction déjà étiquetée', () => {
    const resolved = withStoredConfidence({
      ...failedCorrection(0.01),
      criteria: [],
      overallConfidence: 'MEDIUM',
    });
    expect(resolved.overallConfidence).toBe('MEDIUM');
  });
});

describe('la confiance déclarée par le modèle ne change rien', () => {
  it('produit la même étiquette quel que soit le nombre auto-déclaré', () => {
    // The V4 score guard read exactly this number and believed it. If this
    // test ever fails, the self-report has found its way back in.
    const certain = build([foundCriterion({ confidence: 1 })]);
    const doubtful = build([foundCriterion({ confidence: 0 })]);
    expect(doubtful.criteria[0]?.confidence).toBe(
      certain.criteria[0]?.confidence,
    );
    expect(doubtful.overallConfidence).toBe(certain.overallConfidence);
    expect(doubtful.indicativeScore).toBe(certain.indicativeScore);
  });
});

describe('le prompt de réexamen ne reçoit pas la confiance dérivée', () => {
  it('sérialise la correction précédente sans étiquette de confiance', async () => {
    // The reconsideration prompt embeds the previous correction verbatim and
    // its version is pinned by the promoted identity, so adding fields to it
    // would be an unpromoted prompt change. It would also anchor the second
    // look towards the criteria we already doubted.
    const previous = build([
      foundCriterion(),
      foundCriterion({ criterionKey: 'evidence-selection' }),
    ]);
    expect(previous.overallConfidence).toBe('HIGH');
    expect(previous.criteria[0]?.confidence).toBe('HIGH');

    const harness = buildHarness({
      quote: buildQuote({
        action: 'RECONSIDERATION',
        reconsideration: {
          argument: 'Le second critère mérite un niveau supérieur.',
          previousCorrection: previous,
          sourceCorrectionId: 'correction-0',
        },
      }),
      transport: strictOutput,
    });
    await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    const call = vi.mocked(harness.transport.execute).mock.calls[0]?.[0];
    const prompt = (call?.messages ?? []).map((m) => m.content).join('\n');
    expect(prompt).toContain('<previous-correction>');
    expect(prompt).not.toMatch(/"confidence"/);
    expect(prompt).not.toMatch(/"overallConfidence"/);
  });
});
