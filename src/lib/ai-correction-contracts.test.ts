import {
  assertPublishedCorrectionContractIsImmutable,
  buildProtocol3CorrectionOutputSchema,
  buildProtocol3TransportJsonSchema,
  canonicalizeProtocol3CorrectionOutput,
  correctionContractSchema,
  correctionOutputSchema,
  deriveCorrectionSecondPassDecision,
  evaluateCorrectionSecondPassGate,
  getCorrectionContractRuntimeEligibility,
  legacyCorrectionRubricSchema,
  validateCorrectionOutputForContract,
} from '@/lib/ai-correction-contracts';

const validContract = {
  authorizedReferences: [
    { locator: 'Section 2', referenceId: 'REF-PROJECT-FRAMING' },
  ],
  contractKey: 'project-framing-correction',
  criteria: [
    {
      acceptableVariants: ['Un objectif formulé sous forme de résultat.'],
      calibratedExamples: [
        {
          expectedLevelKey: 'mastered',
          rationale: 'Le résultat et la mesure sont tous deux explicites.',
          responseExcerpt: 'Livrer le prototype mesuré auprès de cinq usagers.',
        },
      ],
      commonErrors: ['Confondre objectif et liste de tâches.'],
      expectedElements: ['Un résultat observable.', 'Une mesure vérifiable.'],
      key: 'direction',
      label: 'Direction du projet',
      objective: 'Formuler une direction commune et vérifiable.',
      performanceLevels: [
        {
          description: 'La direction reste absente ou invérifiable.',
          key: 'insufficient',
          label: 'Insuffisant',
          score: 0,
        },
        {
          description: 'La direction est explicite et mesurable.',
          key: 'mastered',
          label: 'Maîtrisé',
          score: 100,
        },
      ],
      weight: 60,
    },
    {
      acceptableVariants: [],
      calibratedExamples: [],
      commonErrors: ['Omettre les responsables.'],
      expectedElements: ['Au moins un responsable identifié.'],
      key: 'ownership',
      label: 'Responsabilités',
      objective: 'Attribuer les responsabilités principales.',
      performanceLevels: [
        {
          description: 'Les responsabilités ne sont pas attribuées.',
          key: 'insufficient',
          label: 'Insuffisant',
          score: 0,
        },
        {
          description: 'Les responsabilités sont attribuées sans ambiguïté.',
          key: 'mastered',
          label: 'Maîtrisé',
          score: 100,
        },
      ],
      weight: 40,
    },
  ],
  evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
  lifecycle: {
    publishedAt: '2026-08-11T08:00:00+02:00',
    status: 'PUBLISHED',
  },
  objectives: ['Évaluer une proposition de cadrage de projet.'],
  passingScore: 70,
  schemaVersion: 1,
  secondPass: {
    confidenceThreshold: 0.7,
    enabled: true,
    maxPasses: 2,
    triggers: ['LOW_CONFIDENCE'],
  },
  target: {
    activityKey: 'frame-a-project',
    activityType: 'writing',
    kind: 'EXERCISE',
  },
  version: '1.0.0',
} as const;

const validOutput = {
  contractKey: 'project-framing-correction',
  contractVersion: '1.0.0',
  criteria: [
    {
      confidence: 0.9,
      criterionKey: 'direction',
      evidenceQuotes: ['Livrer le prototype mesuré auprès de cinq usagers.'],
      feedback: 'Le résultat attendu est observable.',
      levelKey: 'mastered',
    },
    {
      confidence: 0.85,
      criterionKey: 'ownership',
      evidenceQuotes: ['La responsable produit valide les résultats.'],
      feedback: 'La responsabilité principale est explicite.',
      levelKey: 'mastered',
    },
  ],
  overallConfidence: 0.85,
  overallFeedback: 'Le cadrage est exploitable.',
  secondPass: { reasons: [], required: false },
} as const;

describe('versioned AI correction contracts', () => {
  it('builds a portable protocol 3 transport schema with exact rubric enums', () => {
    const transport = buildProtocol3TransportJsonSchema(validContract);
    const serialized = JSON.stringify(transport);
    const criteria = (
      (transport.properties as Record<string, unknown>).criteria as {
        properties: Record<string, { properties: Record<string, unknown> }>;
      }
    ).properties;

    expect(serialized).not.toContain('oneOf');
    expect(serialized).not.toContain('anyOf');
    expect(serialized).not.toContain('minItems');
    expect(serialized).not.toContain('maxItems');
    expect(serialized).not.toContain('minLength');
    expect(criteria.direction?.properties.levelKey).toEqual({
      enum: validContract.criteria[0]?.performanceLevels.map(
        (level) => level.key,
      ),
      type: 'string',
    });
    expect(criteria.ownership?.properties.evidenceStatus).toEqual({
      enum: ['FOUND', 'NO_RELEVANT_EVIDENCE'],
      type: 'string',
    });
  });

  it('uses exact dynamic rubric keys and keeps score, decision and second pass server-side', () => {
    const modelOutput = {
      criteria: {
        direction: {
          confidence: 0.9,
          evidenceQuotes: ['Une direction explicite.'],
          evidenceStatus: 'FOUND',
          feedback: 'La direction est claire.',
          levelKey: 'mastered',
        },
        ownership: {
          confidence: 0.6,
          evidenceQuotes: [],
          evidenceStatus: 'NO_RELEVANT_EVIDENCE',
          feedback: 'Aucune responsabilité n’est identifiable.',
          levelKey: 'insufficient',
        },
      },
      overallFeedback: 'La direction est acquise, les responsabilités restent à préciser.',
    };
    expect(buildProtocol3CorrectionOutputSchema(validContract).parse(modelOutput))
      .toEqual(modelOutput);
    const canonical = canonicalizeProtocol3CorrectionOutput({
      contract: validContract,
      output: modelOutput,
    });
    expect(canonical).toMatchObject({
      contractKey: validContract.contractKey,
      contractVersion: validContract.version,
      overallConfidence: 0.78,
      secondPass: { reasons: ['LOW_CONFIDENCE'], required: true },
    });
    expect(canonical.criteria.map((criterion) => criterion.criterionKey)).toEqual([
      'direction',
      'ownership',
    ]);
    expect(modelOutput).not.toHaveProperty('contractKey');
    expect(modelOutput).not.toHaveProperty('secondPass');
    expect(modelOutput).not.toHaveProperty('overallConfidence');
  });

  it('rejects missing, extra, duplicated-by-shape and incoherent evidence fields', () => {
    const schema = buildProtocol3CorrectionOutputSchema(validContract);
    const criterion = {
      confidence: 0.9,
      evidenceQuotes: ['Preuve'],
      evidenceStatus: 'FOUND',
      feedback: 'Retour.',
      levelKey: 'mastered',
    };
    expect(
      schema.safeParse({
        criteria: { direction: criterion },
        overallFeedback: 'Retour.',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        criteria: { direction: criterion, ownership: criterion, extra: criterion },
        overallFeedback: 'Retour.',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        criteria: {
          direction: { ...criterion, evidenceQuotes: [] },
          ownership: criterion,
        },
        overallFeedback: 'Retour.',
      }).success,
    ).toBe(false);
    expect(() =>
      canonicalizeProtocol3CorrectionOutput({
        contract: validContract,
        output: {
          criteria: {
            direction: criterion,
            ownership: {
              ...criterion,
              evidenceQuotes: [],
              evidenceStatus: 'NO_RELEVANT_EVIDENCE',
            },
          },
          overallFeedback: 'Retour.',
        },
      }),
    ).toThrow('PROTOCOL_3_NO_EVIDENCE_LEVEL_INCONSISTENT');
  });

  it('accepts a published text contract whose authored weights total 100', () => {
    expect(correctionContractSchema.parse(validContract)).toEqual(
      validContract,
    );
    expect(
      getCorrectionContractRuntimeEligibility(validContract),
    ).toMatchObject({
      eligible: true,
    });
  });

  it('does not impose an arbitrary number of criteria', () => {
    const oneCriterion = {
      ...validContract,
      criteria: [{ ...validContract.criteria[0], weight: 100 }],
    };

    expect(correctionContractSchema.safeParse(oneCriterion).success).toBe(true);
  });

  it('rejects inferred or incomplete criterion weights', () => {
    const invalid = {
      ...validContract,
      criteria: [
        { ...validContract.criteria[0], weight: 50 },
        { ...validContract.criteria[1], weight: 40 },
      ],
    };

    expect(correctionContractSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects duplicate criteria and invalid calibrated level references', () => {
    const invalid = {
      ...validContract,
      criteria: [
        validContract.criteria[0],
        {
          ...validContract.criteria[1],
          calibratedExamples: [
            {
              expectedLevelKey: 'unknown',
              rationale: 'Référence invalide.',
              responseExcerpt: 'Extrait.',
            },
          ],
          key: validContract.criteria[0].key,
        },
      ],
    };

    expect(correctionContractSchema.safeParse(invalid).success).toBe(false);
  });

  it('keeps drafts and future evidence kinds unavailable at runtime', () => {
    const draft = {
      ...validContract,
      lifecycle: { publishedAt: null, status: 'DRAFT' },
    };
    const futureEvidence = {
      ...validContract,
      evidence: { acceptedKinds: ['TEXT', 'AUDIO'], primaryKind: 'TEXT' },
    };

    expect(getCorrectionContractRuntimeEligibility(draft)).toEqual({
      eligible: false,
      reasons: ['CONTRACT_NOT_PUBLISHED'],
    });
    expect(getCorrectionContractRuntimeEligibility(futureEvidence)).toEqual({
      eligible: false,
      reasons: ['EVIDENCE_KIND_NOT_SUPPORTED'],
    });
    expect(getCorrectionContractRuntimeEligibility(undefined)).toEqual({
      eligible: false,
      reasons: ['INVALID_CONTRACT'],
    });
  });

  it('recognizes a valid historical rubric without treating it as a V4 contract', () => {
    const legacyRubric = [
      {
        criterion: 'Exactitude',
        requirements: ['Les concepts attendus sont employés correctement.'],
        weight: 60,
      },
      {
        criterion: 'Argumentation',
        requirements: ['Chaque conclusion est justifiée.'],
        weight: 40,
      },
    ];

    expect(legacyCorrectionRubricSchema.safeParse(legacyRubric).success).toBe(
      true,
    );
    expect(getCorrectionContractRuntimeEligibility(legacyRubric)).toEqual({
      eligible: false,
      reasons: ['INVALID_CONTRACT'],
    });
  });

  it('keeps oral assessments unavailable in the V4 text runtime', () => {
    const oralContract = {
      ...validContract,
      target: {
        activityKey: 'documented-oral',
        activityType: 'oral',
        kind: 'STAGE_ASSESSMENT',
      },
    };

    expect(getCorrectionContractRuntimeEligibility(oralContract)).toEqual({
      eligible: false,
      reasons: ['ACTIVITY_TYPE_NOT_SUPPORTED'],
    });
  });

  it('makes a published contract version immutable while allowing a new version', () => {
    const changedSameVersion = {
      ...validContract,
      passingScore: 80,
    };
    const nextVersion = {
      ...changedSameVersion,
      lifecycle: { publishedAt: null, status: 'DRAFT' },
      version: '1.1.0',
    };

    expect(() =>
      assertPublishedCorrectionContractIsImmutable(
        validContract,
        changedSameVersion,
      ),
    ).toThrow('A published correction contract version cannot be modified.');
    expect(() =>
      assertPublishedCorrectionContractIsImmutable(validContract, nextVersion),
    ).not.toThrow();
  });

  it('validates structured output against criterion and level identities', () => {
    expect(
      validateCorrectionOutputForContract({
        contract: validContract,
        output: validOutput,
      }),
    ).toEqual(correctionOutputSchema.parse(validOutput));

    expect(() =>
      validateCorrectionOutputForContract({
        contract: validContract,
        output: {
          ...validOutput,
          criteria: [validOutput.criteria[0]],
        },
      }),
    ).toThrow('Correction output must assess every criterion exactly once.');
  });

  it('derives second-pass decisions from deterministic server signals', () => {
    const contract = correctionContractSchema.parse({
      ...validContract,
      secondPass: {
        ...validContract.secondPass,
        triggers: [
          'LOW_CONFIDENCE',
          'CRITERION_DISAGREEMENT',
          'OUTPUT_VALIDATION_WARNING',
        ],
      },
    });
    const parsedOutput = correctionOutputSchema.parse(validOutput);
    const lowConfidence = deriveCorrectionSecondPassDecision({
      contract,
      evaluations: [{ ...parsedOutput, overallConfidence: 0.5 }],
    });
    const disagreement = deriveCorrectionSecondPassDecision({
      contract,
      evaluations: [
        parsedOutput,
        {
          ...parsedOutput,
          criteria: parsedOutput.criteria.map((criterion, index) =>
            index === 0 ? { ...criterion, levelKey: 'partial' } : criterion,
          ),
        },
      ],
    });
    const warning = deriveCorrectionSecondPassDecision({
      contract,
      evaluations: [parsedOutput],
      outputValidationWarning: true,
    });
    const noSignal = deriveCorrectionSecondPassDecision({
      contract,
      evaluations: [
        {
          ...parsedOutput,
          secondPass: {
            reasons: ['Le modèle exprime une hésitation.'],
            required: true,
          },
        },
      ],
    });

    expect(lowConfidence).toEqual({
      reasons: ['LOW_CONFIDENCE'],
      required: true,
    });
    expect(disagreement).toEqual({
      reasons: ['CRITERION_DISAGREEMENT'],
      required: true,
    });
    expect(warning).toEqual({
      reasons: ['OUTPUT_VALIDATION_WARNING'],
      required: true,
    });
    expect(noSignal).toEqual({ reasons: [], required: false });
    expect(
      evaluateCorrectionSecondPassGate([
        { actual: lowConfidence, expectedRequired: true },
        { actual: disagreement, expectedRequired: true },
        { actual: warning, expectedRequired: true },
        { actual: noSignal, expectedRequired: false },
      ]),
    ).toEqual({ falseNegativeRate: 0, falsePositiveRate: 0 });
  });

  it('requires a reason when the structured output requests a second pass', () => {
    expect(
      correctionOutputSchema.safeParse({
        ...validOutput,
        secondPass: { reasons: [], required: true },
      }).success,
    ).toBe(false);
  });

  it('rejects model-supplied fields outside the structured contract', () => {
    expect(
      correctionOutputSchema.safeParse({
        ...validOutput,
        score: 100,
      }).success,
    ).toBe(false);
  });
});
