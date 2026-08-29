import {
  allowsIndicativeScore,
  deriveCorrectionConfidence,
  deriveCriterionConfidence,
  type CriterionConfidenceInput,
} from './ai-correction-confidence';

/** A criterion where every signal is clean: verified quote, verifier agreed. */
function criterion(
  overrides: Partial<CriterionConfidenceInput> = {},
): CriterionConfidenceInput {
  return {
    citation: 'VERIFIED',
    evidenceStatus: 'FOUND',
    hardConstraintMismatch: false,
    isFloorLevel: false,
    isMasteredLevel: false,
    verifier: 'AGREED',
    ...overrides,
  };
}

describe('deriveCriterionConfidence', () => {
  it.each([
    ['citation absente', { citation: 'ABSENT' as const }],
    ['citation ambiguë', { citation: 'AMBIGUOUS' as const }],
    [
      'citation rejetée par le vérificateur déterministe',
      {
        citation: 'REJECTED' as const,
      },
    ],
    [
      'contrainte dure signalée au-dessus du plancher',
      {
        hardConstraintMismatch: true,
      },
    ],
    [
      'désaccord du vérificateur indépendant',
      {
        verifier: 'DISAGREED' as const,
      },
    ],
  ])('renvoie LOW pour %s', (_label, overrides) => {
    expect(deriveCriterionConfidence(criterion(overrides))).toBe('LOW');
  });

  it('renvoie MEDIUM sans preuve pertinente au niveau plancher', () => {
    expect(
      deriveCriterionConfidence(
        criterion({
          citation: 'ABSENT',
          evidenceStatus: 'NO_RELEVANT_EVIDENCE',
          isFloorLevel: true,
        }),
      ),
    ).toBe('MEDIUM');
  });

  it('renvoie LOW sans preuve pertinente à un niveau supérieur au plancher', () => {
    // The prompt requires the floor level when nothing was found. A higher
    // level with no evidence is the model contradicting its own instruction.
    expect(
      deriveCriterionConfidence(
        criterion({
          citation: 'ABSENT',
          evidenceStatus: 'NO_RELEVANT_EVIDENCE',
          isFloorLevel: false,
        }),
      ),
    ).toBe('LOW');
  });

  it('plafonne à MEDIUM quand le vérificateur est indisponible', () => {
    expect(
      deriveCriterionConfidence(
        criterion({ isMasteredLevel: true, verifier: 'UNAVAILABLE' }),
      ),
    ).toBe('MEDIUM');
  });

  it.each([
    ['plancher', { isFloorLevel: true }],
    ['maîtrisé', { isMasteredLevel: true }],
  ])(
    'renvoie HIGH au niveau extrême %s avec citation vérifiée et accord',
    (_label, overrides) => {
      expect(deriveCriterionConfidence(criterion(overrides))).toBe('HIGH');
    },
  );

  it('renvoie MEDIUM à un niveau intermédiaire, même tout vérifié', () => {
    expect(deriveCriterionConfidence(criterion())).toBe('MEDIUM');
  });

  it('ne consulte jamais la confiance déclarée par le modèle', () => {
    // The V4 score guard asked the model how sure it was and believed the
    // answer. Nothing in this input carries that, and nothing may.
    const keys = Object.keys(criterion());
    expect(keys).not.toContain('modelConfidence');
    expect(keys).not.toContain('selfReportedConfidence');
    expect(keys.some((key) => /score/i.test(key))).toBe(false);
  });
});

describe('deriveCorrectionConfidence', () => {
  it('retient le critère le plus faible', () => {
    expect(
      deriveCorrectionConfidence({
        criteria: [
          criterion({ isMasteredLevel: true }),
          criterion({ verifier: 'DISAGREED' }),
        ],
        familyScientificallyValidated: true,
      }),
    ).toBe('LOW');
  });

  it('plafonne à MEDIUM hors du périmètre scientifiquement validé', () => {
    expect(
      deriveCorrectionConfidence({
        criteria: [criterion({ isMasteredLevel: true })],
        familyScientificallyValidated: false,
      }),
    ).toBe('MEDIUM');
  });

  it('plafonne toute la correction quand un vérificateur manque', () => {
    expect(
      deriveCorrectionConfidence({
        criteria: [
          criterion({ isMasteredLevel: true }),
          criterion({ isFloorLevel: true, verifier: 'UNAVAILABLE' }),
        ],
        familyScientificallyValidated: true,
      }),
    ).toBe('MEDIUM');
  });

  it('renvoie LOW sans critère livré', () => {
    expect(
      deriveCorrectionConfidence({
        criteria: [],
        familyScientificallyValidated: true,
      }),
    ).toBe('LOW');
  });
});

describe('allowsIndicativeScore', () => {
  it('autorise le score quand tout est HIGH ou MEDIUM', () => {
    expect(
      allowsIndicativeScore({
        criteria: [criterion({ isFloorLevel: true }), criterion()],
        familyScientificallyValidated: true,
      }),
    ).toBe(true);
  });

  it('retire le score dès qu’un critère est LOW', () => {
    expect(
      allowsIndicativeScore({
        criteria: [criterion(), criterion({ citation: 'REJECTED' })],
        familyScientificallyValidated: true,
      }),
    ).toBe(false);
  });

  it('retire le score sans critère livré', () => {
    expect(
      allowsIndicativeScore({
        criteria: [],
        familyScientificallyValidated: true,
      }),
    ).toBe(false);
  });
});
