import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import {
  buildEvidenceCertificateV2,
  compileExecutableRubricBySchemaVersion,
  compileExecutableRubricV2,
  consolidateIndependentEvidenceV2,
  evidenceSpanForV2,
  type CompiledExecutableRubricV2,
  type EvidenceFindingV2,
  type EvidencePassV2,
  type ExecutableRubricV2,
} from './executable-rubric-engine-v2.ts';

const root = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric',
);
const rubricV2Path = resolve(
  root,
  'writing-framework-selection-fr.v1.draft.json',
);
const rubricV1Path = resolve(root, 'writing-recommendation-fr.v1.json');
const rubricHistoricalV2NamePath = resolve(
  root,
  'writing-go-no-go-recommendation-fr.v2.json',
);

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadRubricV2(): ExecutableRubricV2 {
  return loadJson(rubricV2Path) as ExecutableRubricV2;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

const responseText = [
  'Projet A : je retiens PICO.',
  "Pour A, j'utilise population, intervention, comparaison et résultat ; aucune dimension ne reste ouverte.",
  'Le projet A concerne des étudiants de première année.',
  'Le projet A compare deux pratiques et mesure un effet comparatif.',
  'Cette comparaison et ce résultat rendent PICO utile pour structurer le projet A.',
  'Projet B : je retiens SPIDER.',
  "Pour B, j'utilise échantillon, phénomène, design, évaluation et type qualitatif ; aucune dimension ne reste ouverte.",
  'Le projet B repose sur des entretiens qualitatifs.',
  "Le projet B cherche à comprendre l'expérience rapportée.",
  "Ces entretiens et cette expérience rendent SPIDER utile pour structurer le projet B.",
].join(' ');

const phrasesByElement: Record<string, string[]> = {
  'project-a-framework-choice': ['Projet A : je retiens PICO.'],
  'project-a-dimension-scope': [
    "Pour A, j'utilise population, intervention, comparaison et résultat ; aucune dimension ne reste ouverte.",
  ],
  'project-a-dossier-fact-1': [
    'Le projet A concerne des étudiants de première année.',
  ],
  'project-a-dossier-fact-2': [
    'Le projet A compare deux pratiques et mesure un effet comparatif.',
  ],
  'project-a-choice-rationale': [
    'Le projet A compare deux pratiques et mesure un effet comparatif.',
    'Cette comparaison et ce résultat rendent PICO utile pour structurer le projet A.',
  ],
  'project-b-framework-choice': ['Projet B : je retiens SPIDER.'],
  'project-b-dimension-scope': [
    "Pour B, j'utilise échantillon, phénomène, design, évaluation et type qualitatif ; aucune dimension ne reste ouverte.",
  ],
  'project-b-dossier-fact-1': [
    'Le projet B repose sur des entretiens qualitatifs.',
  ],
  'project-b-dossier-fact-2': [
    "Le projet B cherche à comprendre l'expérience rapportée.",
  ],
  'project-b-choice-rationale': [
    'Le projet B repose sur des entretiens qualitatifs.',
    "Ces entretiens et cette expérience rendent SPIDER utile pour structurer le projet B.",
  ],
};

const claimByElement: Record<string, string> = {
  'project-a-dossier-fact-1': 'a-population-first-year',
  'project-a-dossier-fact-2': 'a-comparative-effect',
  'project-b-dossier-fact-1': 'b-qualitative-interviews',
  'project-b-dossier-fact-2': 'b-understand-experience',
};

const frameworkByScenario: Record<string, 'PICO' | 'SPIDER'> = {
  'project-a': 'PICO',
  'project-b': 'SPIDER',
};

function spanFor(phrase: string) {
  const start = responseText.indexOf(phrase);
  if (start < 0) throw new Error(`PHRASE_NOT_FOUND_${phrase}`);
  return evidenceSpanForV2(responseText, start, start + phrase.length);
}

function frameworkConditionsFor(
  scenarioKey: 'project-a' | 'project-b',
) {
  const conditionKeys =
    scenarioKey === 'project-a'
      ? [
          'a-retrieval-treated-as-exposure',
          'a-comparison-preserved',
          'a-outcome-preserved',
        ]
      : [
          'b-adult-population-linked',
          'b-training-experience-linked',
          'b-remote-context-linked',
        ];
  const evidenceSpans = phrasesByElement[
    `${scenarioKey}-choice-rationale`
  ].map(spanFor);
  return conditionKeys.map((conditionKey) => ({
    conditionKey,
    evidenceSpans,
  }));
}

type FindingOverride = Partial<
  Omit<EvidenceFindingV2, 'elementKey'>
>;

function evidencePassV2(input: {
  compiled: CompiledExecutableRubricV2;
  overrides?: Partial<Record<string, FindingOverride>>;
  role: EvidencePassV2['role'];
}): EvidencePassV2 {
  return {
    findings: input.compiled.rubric.elements.map((element) => {
      const override = input.overrides?.[element.key];
      const status = override?.status ?? 'SUPPORTED';
      const phrases = phrasesByElement[element.key] ?? [];
      const defaultSpans = phrases.map(spanFor);
      const evidenceSpans =
        status === 'NOT_DEMONSTRATED' ? [] : defaultSpans;
      const frameworkBindingRequired =
        element.key.endsWith('-framework-choice') ||
        element.evidenceRule.relationRoles?.some(
          (role) => role === 'FRAMEWORK' || role === 'FRAMEWORK_CHOICE',
        );
      return {
        confidence: 0.9,
        conflicts: [],
        elementKey: element.key,
        evidenceSpans,
        frameworkConditions: [],
        frameworkKey: frameworkBindingRequired
          ? frameworkByScenario[element.scenarioKey]
          : null,
        relationBindings:
          evidenceSpans.length > 0
            ? (element.evidenceRule.relationRoles ?? []).map((role) => ({
                evidenceSpans,
                role,
              }))
            : [],
        status,
        trustedClaimKeys:
          status === 'SUPPORTED' && claimByElement[element.key]
            ? [required(claimByElement[element.key])]
            : [],
        ...override,
      } satisfies EvidenceFindingV2;
    }),
    pipelineFingerprint:
      input.role === 'EVIDENCE_RESEARCHER'
        ? 'a'.repeat(64)
        : 'b'.repeat(64),
    role: input.role,
  };
}

function certificateFor(input: {
  compiled: CompiledExecutableRubricV2;
  falsifierOverrides?: Partial<Record<string, FindingOverride>>;
  researcherOverrides?: Partial<Record<string, FindingOverride>>;
}) {
  const consolidatedEvidence = consolidateIndependentEvidenceV2({
    compiled: input.compiled,
    falsifier: evidencePassV2({
      compiled: input.compiled,
      overrides: input.falsifierOverrides ?? input.researcherOverrides,
      role: 'EVIDENCE_FALSIFIER',
    }),
    researcher: evidencePassV2({
      compiled: input.compiled,
      overrides: input.researcherOverrides,
      role: 'EVIDENCE_RESEARCHER',
    }),
    responseText,
  });
  return buildEvidenceCertificateV2({ compiled: input.compiled, consolidatedEvidence });
}

describe('executable rubric v2 compiler', () => {
  it('compiles the Rayan B contract offline without publishing it', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());

    expect(compiled.compilationStatus).toBe('COMPILED_OFFLINE');
    expect(compiled.certificateVersion).toBe(2);
    expect(compiled.rubric.criteria).toHaveLength(3);
    expect(compiled.rubric.elements).toHaveLength(10);
    expect(compiled.rubric.lifecycle).toBe('DRAFT');
    expect(compiled.rubric.publicationPolicy.contractMayPublishBeforeCompilation).toBe(false);
    expect(compiled.rubricFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('routes v1 and v2 explicitly while preserving historical fingerprints', () => {
    const v1 = loadJson(rubricV1Path);
    const historical = loadJson(rubricHistoricalV2NamePath);
    const routedV1 = compileExecutableRubricBySchemaVersion(v1);
    const routedV2 = compileExecutableRubricBySchemaVersion(loadRubricV2());

    expect(routedV1.schemaVersion).toBe(1);
    expect(routedV2.schemaVersion).toBe(2);
    expect(compileExecutableRubric(v1).rubricFingerprint).toBe(
      '9cb8ada85eafaf65974f5ae72e4050ee23b468e265748d5780b5c64f1d60ad7b',
    );
    expect(compileExecutableRubric(historical).rubricFingerprint).toBe(
      '6206d4a8dfab0715da008de1265e63a1e246b753026a72622447277c19ed47b4',
    );
  });

  it('rejects a hidden owner or sharing mutation', () => {
    const rubric = structuredClone(loadRubricV2());
    required(rubric.elements.at(0)).sharedWithCriterionKeys = ['dossier-fidelity'];

    expect(() => compileExecutableRubricV2(rubric)).toThrow(
      'SHARED_ELEMENT_NOT_AUTHORIZED_FOR_PILOT',
    );

    const foreignOwner = structuredClone(loadRubricV2());
    required(
      foreignOwner.criteria.find(({ key }) => key === 'choice-rationale'),
    ).elementKeys.push('project-a-framework-choice');
    expect(() => compileExecutableRubricV2(foreignOwner)).toThrow(
      'CRITERION_CONTAINS_FOREIGN_ELEMENT',
    );
  });

  it('rejects a mastered rule that allows an incomplete project', () => {
    const rubric = structuredClone(loadRubricV2());
    const criterion = required(
      rubric.criteria.find(({ key }) => key === 'framework-decision'),
    );
    required(criterion.levels.find(({ key }) => key === 'mastered')).when = {
      supportedCount: { maximum: 4, minimum: 3 },
    };
    required(criterion.levels.find(({ key }) => key === 'partial')).when = {
      supportedCount: { maximum: 2, minimum: 1 },
    };

    expect(() => compileExecutableRubricV2(rubric)).toThrow(
      'MASTERED_ALLOWS_INCOMPLETE_SCENARIO',
    );
  });

  it('rejects cross-scenario dependencies and evidence groups', () => {
    const dependencyMutation = structuredClone(loadRubricV2());
    required(
      dependencyMutation.elements.find(
        ({ key }) => key === 'project-a-dimension-scope',
      ),
    ).dependsOn = {
      elementKey: 'project-b-framework-choice',
      whenUnsatisfied: 'BLOCKED_BY_DEPENDENCY',
    };
    expect(() => compileExecutableRubricV2(dependencyMutation)).toThrow(
      'CROSS_SCENARIO_DEPENDENCY',
    );

    const groupMutation = structuredClone(loadRubricV2());
    required(groupMutation.evidenceGroups.at(0)).elementKeys[1] =
      'project-b-dossier-fact-1';
    expect(() => compileExecutableRubricV2(groupMutation)).toThrow(
      'INVALID_EVIDENCE_GROUP_MEMBERSHIP',
    );
  });

  it('rejects cyclic dependencies and overlapping level rules', () => {
    const dependencyMutation = structuredClone(loadRubricV2());
    required(
      dependencyMutation.elements.find(
        ({ key }) => key === 'project-a-framework-choice',
      ),
    ).dependsOn = {
      elementKey: 'project-a-dimension-scope',
      whenUnsatisfied: 'BLOCKED_BY_DEPENDENCY',
    };
    expect(() => compileExecutableRubricV2(dependencyMutation)).toThrow(
      'CYCLIC_ELEMENT_DEPENDENCY',
    );

    const ruleMutation = structuredClone(loadRubricV2());
    const criterion = required(
      ruleMutation.criteria.find(({ key }) => key === 'framework-decision'),
    );
    required(criterion.levels.find(({ key }) => key === 'partial')).when = {
      supportedCount: { maximum: 4, minimum: 1 },
    };
    expect(() => compileExecutableRubricV2(ruleMutation)).toThrow(
      'OVERLAPPING_LEVEL_RULES',
    );
  });

  it('requires complete framework and trusted-claim partitions', () => {
    const frameworkMutation = structuredClone(loadRubricV2());
    required(
      frameworkMutation.frameworkPolicy.scenarioMappings.find(
        ({ scenarioKey }) => scenarioKey === 'project-a',
      ),
    ).rejectedUnlessReauthored = ['SPIDER'];
    expect(() => compileExecutableRubricV2(frameworkMutation)).toThrow(
      'INVALID_FRAMEWORK_PARTITION',
    );

    const missingScenarioMapping = structuredClone(loadRubricV2());
    missingScenarioMapping.frameworkPolicy.scenarioMappings.pop();
    expect(() => compileExecutableRubricV2(missingScenarioMapping)).toThrow(
      'INCOMPLETE_FRAMEWORK_SCENARIO_MAPPING',
    );

    const missingConditionalRule = structuredClone(loadRubricV2());
    delete required(
      missingConditionalRule.frameworkPolicy.scenarioMappings.find(
        ({ scenarioKey }) => scenarioKey === 'project-a',
      ),
    ).conditionalRules.PECO;
    expect(() => compileExecutableRubricV2(missingConditionalRule)).toThrow(
      'INCOMPLETE_CONDITIONAL_FRAMEWORK_RULES',
    );

    const claimGroupMutation = structuredClone(loadRubricV2());
    required(
      claimGroupMutation.elements.find(
        ({ key }) => key === 'project-a-dossier-fact-1',
      ),
    ).trustedClaimGroup = 'project-b-claims';
    expect(() => compileExecutableRubricV2(claimGroupMutation)).toThrow(
      'INVALID_ELEMENT_TRUSTED_CLAIM_GROUP',
    );
  });

  it('rejects score, progression and prompt hash mutations', () => {
    const scoreMutation = structuredClone(loadRubricV2()) as unknown as Record<
      string,
      unknown
    >;
    scoreMutation.scorePolicy = {
      indicativeScoreEnabled: true,
      publishExactScoreWhenAmbiguousLevelIsStable: false,
    };
    expect(() => compileExecutableRubricV2(scoreMutation)).toThrow();

    const progressionMutation = structuredClone(loadRubricV2()) as unknown as Record<
      string,
      unknown
    >;
    progressionMutation.progressionAuthority = 'MODEL';
    expect(() => compileExecutableRubricV2(progressionMutation)).toThrow();

    const hashMutation = structuredClone(loadRubricV2());
    hashMutation.activityBinding.prompt.text += ' mutation';
    expect(() => compileExecutableRubricV2(hashMutation)).toThrow(
      'PROMPT_HASH_MISMATCH',
    );
  });
});

describe('executable rubric v2 certificate', () => {
  it('builds a fully demonstrated certificate without score or progression', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const certificate = certificateFor({ compiled });

    expect(certificate.certificateVersion).toBe(2);
    expect(certificate.criteria.map(({ levelKey }) => levelKey)).toEqual([
      'mastered',
      'mastered',
      'mastered',
    ]);
    expect(certificate.correctionState).toBe('FEEDBACK_READY');
    expect(certificate.indicativeScore).toBeNull();
    expect(certificate.progressionEffect).toBe('NONE');
  });

  it('keeps a false project property local to fidelity', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const span = spanFor('Le projet A concerne des étudiants de première année.');
    const mismatch: FindingOverride = {
      conflicts: [
        {
          evidenceSpans: [span],
          kind: 'CONTEXT_MISMATCH',
          scenarioKey: 'project-a',
          trustedClaimKeys: ['a-population-first-year'],
        },
      ],
      evidenceSpans: [],
      status: 'CONTRADICTED',
      trustedClaimKeys: [],
    };
    const certificate = certificateFor({
      compiled,
      researcherOverrides: { 'project-a-dossier-fact-1': mismatch },
    });

    expect(certificate.criteria.map(({ levelKey }) => levelKey)).toEqual([
      'mastered',
      'insufficient',
      'mastered',
    ]);
    expect(certificate.correctionState).toBe('REVISION_REQUIRED');
  });

  it('keeps a one-pass context mismatch materially ambiguous', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const span = spanFor('Le projet A concerne des étudiants de première année.');
    const mismatch: FindingOverride = {
      conflicts: [
        {
          evidenceSpans: [span],
          kind: 'CONTEXT_MISMATCH',
          scenarioKey: 'project-a',
          trustedClaimKeys: ['a-population-first-year'],
        },
      ],
      evidenceSpans: [],
      status: 'CONTRADICTED',
      trustedClaimKeys: [],
    };
    const consolidatedEvidence = consolidateIndependentEvidenceV2({
      compiled,
      falsifier: evidencePassV2({
        compiled,
        overrides: { 'project-a-dossier-fact-1': mismatch },
        role: 'EVIDENCE_FALSIFIER',
      }),
      researcher: evidencePassV2({
        compiled,
        role: 'EVIDENCE_RESEARCHER',
      }),
      responseText,
    });
    const certificate = buildEvidenceCertificateV2({
      compiled,
      consolidatedEvidence,
    });

    expect(
      required(
        certificate.elements.find(
          ({ contextMismatchState, scenarioKey }) =>
            scenarioKey === 'project-a' &&
            contextMismatchState === 'AMBIGUOUS',
        ),
      ).contextMismatchState,
    ).toBe('AMBIGUOUS');
    expect(required(certificate.criteria.at(1)).possibleLevelKeys).toEqual([
      'insufficient',
      'partial',
      'mastered',
    ]);
    expect(required(certificate.criteria.at(1)).levelKey).toBeNull();
    expect(certificate.correctionState).toBe('CLARIFICATION_REQUIRED');
  });

  it('blocks derivative feedback when the root evidence is absent', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-dimension-scope': { status: 'NOT_DEMONSTRATED' },
        'project-a-framework-choice': { status: 'NOT_DEMONSTRATED' },
      },
    });

    expect(
      required(
        certificate.elements.find(
          ({ elementKey }) => elementKey === 'project-a-dimension-scope',
        ),
      ).resolutionState,
    ).toBe('BLOCKED_BY_DEPENDENCY');
    expect(
      certificate.feedback.filter(({ elementKey }) =>
        elementKey.startsWith('project-a-'),
      ).map(({ elementKey }) => elementKey),
    ).not.toContain('project-a-dimension-scope');
  });

  it('does not let a complete project compensate for an absent project', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const absentB = Object.fromEntries(
      compiled.rubric.elements
        .filter(({ scenarioKey }) => scenarioKey === 'project-b')
        .map(({ key }) => [key, { status: 'NOT_DEMONSTRATED' as const }]),
    );
    const certificate = certificateFor({
      compiled,
      researcherOverrides: absentB,
    });

    expect(certificate.criteria.every(({ levelKey }) => levelKey !== 'mastered')).toBe(
      true,
    );
  });

  it('blocks rationale when no project property is formulated', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-choice-rationale': { status: 'NOT_DEMONSTRATED' },
        'project-a-dossier-fact-1': { status: 'NOT_DEMONSTRATED' },
        'project-a-dossier-fact-2': { status: 'NOT_DEMONSTRATED' },
      },
    });

    expect(
      required(
        certificate.elements.find(
          ({ elementKey }) => elementKey === 'project-a-choice-rationale',
        ),
      ).resolutionState,
    ).toBe('BLOCKED_BY_DEPENDENCY');
    expect(
      certificate.feedback.some(
        ({ elementKey }) => elementKey === 'project-a-choice-rationale',
      ),
    ).toBe(false);
  });

  it('distinguishes explicit refusal from omission without changing the level', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const omission = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-framework-choice': { status: 'NOT_DEMONSTRATED' },
      },
    });
    const refusal = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-framework-choice': {
          evidenceSpans: [spanFor('Projet A : je retiens PICO.')],
          status: 'EXPLICITLY_REFUTED',
        },
      },
    });

    expect(required(omission.criteria.at(0)).levelKey).toBe(
      required(refusal.criteria.at(0)).levelKey,
    );
    expect(
      required(
        refusal.feedback.find(
          ({ elementKey }) => elementKey === 'project-a-framework-choice',
        ),
      ).status,
    ).toBe('EXPLICITLY_REFUTED');
    expect(refusal.feedback).not.toEqual(omission.feedback);
  });

  it('withholds a level for a material ambiguity', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-framework-choice': { status: 'AMBIGUOUS' },
      },
    });

    expect(required(certificate.criteria.at(0)).possibleLevelKeys).toEqual([
      'partial',
      'mastered',
    ]);
    expect(required(certificate.criteria.at(0)).levelKey).toBeNull();
    expect(certificate.correctionState).toBe('CLARIFICATION_REQUIRED');
    expect(certificate.indicativeScore).toBeNull();
  });

  it('rejects an ambiguity that is not grounded in an exact span or conflict', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-framework-choice': {
              evidenceSpans: [],
              status: 'AMBIGUOUS',
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('AMBIGUOUS_REQUIRES_EXACT_EVIDENCE');
  });

  it('publishes a stable level for a non-material ambiguity', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-framework-choice': { status: 'AMBIGUOUS' },
        'project-b-dimension-scope': { status: 'NOT_DEMONSTRATED' },
      },
    });

    expect(required(certificate.criteria.at(0)).possibleLevelKeys).toEqual([
      'partial',
    ]);
    expect(required(certificate.criteria.at(0)).levelKey).toBe('partial');
    expect(certificate.correctionState).toBe('REVISION_REQUIRED');
  });

  it('keeps framework fit conflicts out of the decision criterion', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-choice-rationale': {
          conflicts: [
            {
              evidenceSpans: [],
              kind: 'FRAMEWORK_MAPPING_MISMATCH',
              scenarioKey: 'project-a',
              trustedClaimKeys: [],
            },
          ],
          status: 'CONTRADICTED',
        },
      },
    });

    expect(required(certificate.criteria.at(0)).levelKey).toBe('mastered');
    expect(required(certificate.criteria.at(2)).levelKey).toBe('partial');
  });

  it('keeps an accepted framework choice while localizing a rejected mapping', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const rejectedMapping: FindingOverride = {
      conflicts: [
        {
          evidenceSpans: [],
          kind: 'FRAMEWORK_MAPPING_MISMATCH',
          scenarioKey: 'project-a',
          trustedClaimKeys: [],
        },
      ],
      frameworkKey: 'SPIDER',
      status: 'CONTRADICTED',
    };
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-choice-rationale': rejectedMapping,
        'project-a-dimension-scope': { frameworkKey: 'SPIDER' },
        'project-a-framework-choice': { frameworkKey: 'SPIDER' },
      },
    });

    expect(required(certificate.criteria.at(0)).levelKey).toBe('mastered');
    expect(required(certificate.criteria.at(2)).levelKey).toBe('partial');
    expect(
      required(
        certificate.elements.find(
          ({ elementKey }) => elementKey === 'project-a-framework-choice',
        ),
      ).frameworkKey,
    ).toBe('SPIDER');
  });

  it('rejects a supported rationale bound to a non-authorized framework', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const overrides = {
      'project-a-choice-rationale': { frameworkKey: 'SPIDER' as const },
      'project-a-dimension-scope': { frameworkKey: 'SPIDER' as const },
      'project-a-framework-choice': { frameworkKey: 'SPIDER' as const },
    };

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides,
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides,
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('UNAUTHORIZED_FRAMEWORK_MAPPING');
  });

  it('executes every authored PECO and PCC acceptance condition', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const incompletePecoConditions = frameworkConditionsFor('project-a').slice(
      0,
      2,
    );
    const pecoOverrides = {
      'project-a-choice-rationale': {
        frameworkConditions: incompletePecoConditions,
        frameworkKey: 'PECO' as const,
      },
      'project-a-dimension-scope': { frameworkKey: 'PECO' as const },
      'project-a-framework-choice': { frameworkKey: 'PECO' as const },
    };
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides: pecoOverrides,
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides: pecoOverrides,
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('FRAMEWORK_CONDITIONS_NOT_DEMONSTRATED');

    const pccOverrides = {
      'project-b-choice-rationale': {
        frameworkConditions: frameworkConditionsFor('project-b').slice(0, 2),
        frameworkKey: 'PCC' as const,
      },
      'project-b-dimension-scope': { frameworkKey: 'PCC' as const },
      'project-b-framework-choice': { frameworkKey: 'PCC' as const },
    };
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides: pccOverrides,
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides: pccOverrides,
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('FRAMEWORK_CONDITIONS_NOT_DEMONSTRATED');

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides: {
            ...pecoOverrides,
            'project-a-choice-rationale': {
              frameworkConditions: frameworkConditionsFor('project-a'),
              frameworkKey: 'PECO',
            },
          },
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            ...pecoOverrides,
            'project-a-choice-rationale': {
              frameworkConditions: frameworkConditionsFor('project-a'),
              frameworkKey: 'PECO',
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).not.toThrow();

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides: {
            ...pccOverrides,
            'project-b-choice-rationale': {
              frameworkConditions: frameworkConditionsFor('project-b'),
              frameworkKey: 'PCC',
            },
          },
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            ...pccOverrides,
            'project-b-choice-rationale': {
              frameworkConditions: frameworkConditionsFor('project-b'),
              frameworkKey: 'PCC',
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).not.toThrow();
  });

  it('turns an independent framework-binding disagreement into ambiguity', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const falsifierOverrides = {
      'project-a-choice-rationale': {
        frameworkConditions: frameworkConditionsFor('project-a'),
        frameworkKey: 'PECO' as const,
      },
      'project-a-dimension-scope': { frameworkKey: 'PECO' as const },
      'project-a-framework-choice': { frameworkKey: 'PECO' as const },
    };
    const consolidated = consolidateIndependentEvidenceV2({
      compiled,
      falsifier: evidencePassV2({
        compiled,
        overrides: falsifierOverrides,
        role: 'EVIDENCE_FALSIFIER',
      }),
      researcher: evidencePassV2({
        compiled,
        role: 'EVIDENCE_RESEARCHER',
      }),
      responseText,
    });

    expect(
      consolidated.elements
        .filter(({ elementKey }) =>
          [
            'project-a-framework-choice',
            'project-a-dimension-scope',
            'project-a-choice-rationale',
          ].includes(elementKey),
        )
        .map(({ frameworkKey, status }) => ({ frameworkKey, status })),
    ).toEqual([
      { frameworkKey: null, status: 'AMBIGUOUS' },
      { frameworkKey: null, status: 'AMBIGUOUS' },
      { frameworkKey: null, status: 'AMBIGUOUS' },
    ]);
  });

  it('deduplicates a refusal repeated across both fact slots', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const refusalSpan = spanFor(
      'Le projet A concerne des étudiants de première année.',
    );
    const repeatedRefusal: FindingOverride = {
      evidenceSpans: [refusalSpan],
      status: 'EXPLICITLY_REFUTED',
      trustedClaimKeys: [],
    };
    const certificate = certificateFor({
      compiled,
      researcherOverrides: {
        'project-a-dossier-fact-1': repeatedRefusal,
        'project-a-dossier-fact-2': repeatedRefusal,
      },
    });

    const groupElements = certificate.elements.filter(({ elementKey }) =>
      elementKey.startsWith('project-a-dossier-fact'),
    );
    expect(
      groupElements.filter(
        ({ resolutionState }) => resolutionState === 'EXPLICITLY_REFUTED',
      ),
    ).toHaveLength(1);
    expect(
      groupElements.filter(
        ({ resolutionState }) => resolutionState === 'BLOCKED_BY_DEPENDENCY',
      ),
    ).toHaveLength(1);
    expect(
      certificate.feedback.filter(
        ({ criterionKey, status }) =>
          criterionKey === 'dossier-fidelity' &&
          status === 'EXPLICITLY_REFUTED',
      ),
    ).toHaveLength(1);
    expect(
      required(
        certificate.elements.find(
          ({ elementKey }) => elementKey === 'project-a-choice-rationale',
        ),
      ).resolutionState,
    ).toBe('BLOCKED_BY_DEPENDENCY');
    expect(
      certificate.feedback.some(
        ({ elementKey }) => elementKey === 'project-a-choice-rationale',
      ),
    ).toBe(false);
  });

  it('canonicalizes freely chosen facts before comparing independent passes', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const swapped: Partial<Record<string, FindingOverride>> = {
      'project-a-dossier-fact-1': {
        evidenceSpans: phrasesByElement['project-a-dossier-fact-2'].map(spanFor),
        trustedClaimKeys: ['a-comparative-effect'],
      },
      'project-a-dossier-fact-2': {
        evidenceSpans: phrasesByElement['project-a-dossier-fact-1'].map(spanFor),
        trustedClaimKeys: ['a-population-first-year'],
      },
    };
    const consolidated = consolidateIndependentEvidenceV2({
      compiled,
      falsifier: evidencePassV2({
        compiled,
        overrides: swapped,
        role: 'EVIDENCE_FALSIFIER',
      }),
      researcher: evidencePassV2({
        compiled,
        role: 'EVIDENCE_RESEARCHER',
      }),
      responseText,
    });

    expect(
      consolidated.elements
        .filter(({ elementKey }) => elementKey.startsWith('project-a-dossier-fact'))
        .map(({ status }) => status),
    ).toEqual(['SUPPORTED', 'SUPPORTED']);
  });

  it('turns a trusted-claim disagreement into ambiguity', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const verifierClaims: Partial<Record<string, FindingOverride>> = {
      'project-a-dossier-fact-1': {
        trustedClaimKeys: ['a-duration-eight-weeks'],
      },
      'project-a-dossier-fact-2': {
        trustedClaimKeys: ['a-retrieval-weekly'],
      },
    };
    const consolidated = consolidateIndependentEvidenceV2({
      compiled,
      falsifier: evidencePassV2({
        compiled,
        overrides: verifierClaims,
        role: 'EVIDENCE_FALSIFIER',
      }),
      researcher: evidencePassV2({
        compiled,
        role: 'EVIDENCE_RESEARCHER',
      }),
      responseText,
    });

    expect(
      consolidated.elements
        .filter(({ elementKey }) =>
          elementKey.startsWith('project-a-dossier-fact'),
        )
        .map(({ status }) => status),
    ).toEqual(['AMBIGUOUS', 'AMBIGUOUS']);
    expect(
      buildEvidenceCertificateV2({ compiled, consolidatedEvidence: consolidated })
        .correctionState,
    ).toBe('CLARIFICATION_REQUIRED');
  });

  it('rejects duplicate claims or response occurrences inside a fact group', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const duplicateClaim: Partial<Record<string, FindingOverride>> = {
      'project-a-dossier-fact-2': {
        trustedClaimKeys: ['a-population-first-year'],
      },
    };
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides: duplicateClaim,
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides: duplicateClaim,
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('EVIDENCE_GROUP_DUPLICATE_TRUSTED_CLAIM');

    const duplicateSpan: Partial<Record<string, FindingOverride>> = {
      'project-a-dossier-fact-2': {
        evidenceSpans: phrasesByElement['project-a-dossier-fact-1'].map(spanFor),
      },
    };
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({
          compiled,
          overrides: duplicateSpan,
          role: 'EVIDENCE_FALSIFIER',
        }),
        researcher: evidencePassV2({
          compiled,
          overrides: duplicateSpan,
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('EVIDENCE_GROUP_DUPLICATE_RESPONSE_SPAN');
  });

  it('requires exact spans and all authored relation roles', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const invalidSpan = spanFor('Projet A : je retiens PICO.');
    invalidSpan.text = 'Texte inventé';
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-framework-choice': { evidenceSpans: [invalidSpan] },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('EVIDENCE_SPAN_MISMATCH');

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-choice-rationale': { relationBindings: [] },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('EVIDENCE_RELATION_ROLE_COVERAGE_MISMATCH');

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-framework-choice': {
              relationBindings: [
                {
                  evidenceSpans: [spanFor('Projet A : je retiens PICO.')],
                  role: 'UNAUTHORED_ROLE',
                },
              ],
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('UNKNOWN_EVIDENCE_RELATION_ROLE');

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-choice-rationale': {
              relationBindings: [
                {
                  evidenceSpans: [spanFor('Projet B : je retiens SPIDER.')],
                  role: 'FRAMEWORK_CHOICE',
                },
                ...['PROJECT_PROPERTY', 'FIT_EXPLANATION'].map((role) => ({
                  evidenceSpans:
                    phrasesByElement['project-a-choice-rationale'].map(spanFor),
                  role,
                })),
              ],
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('RELATION_ROLE_SPAN_NOT_IN_FINDING');
  });

  it('does not count conflict spans against a supported finding cardinality', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const supportedWithDiagnosticConflicts: FindingOverride = {
      conflicts: [
        {
          evidenceSpans: [
            spanFor('Le projet B repose sur des entretiens qualitatifs.'),
            spanFor("Le projet B cherche à comprendre l'expérience rapportée."),
          ],
          kind: 'INTERNAL_CONFLICT',
          scenarioKey: 'project-a',
          trustedClaimKeys: [],
        },
      ],
    };
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-framework-choice': supportedWithDiagnosticConflicts,
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).not.toThrow();
  });

  it('refuses a fabricated consolidated payload that bypasses pass validation', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    const valid = consolidateIndependentEvidenceV2({
      compiled,
      falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
      researcher: evidencePassV2({ compiled, role: 'EVIDENCE_RESEARCHER' }),
      responseText,
    });
    const fabricated = {
      elements: valid.elements,
      pipelineFingerprint: valid.pipelineFingerprint,
    } as Parameters<typeof buildEvidenceCertificateV2>[0]['consolidatedEvidence'];

    expect(() =>
      buildEvidenceCertificateV2({ compiled, consolidatedEvidence: fabricated }),
    ).toThrow('UNVALIDATED_CONSOLIDATED_EVIDENCE');

    const copiedElements = structuredClone(valid.elements);
    required(copiedElements.at(0)).frameworkKey = null;
    required(copiedElements.at(0)).status = 'SUPPORTED';
    const spreadMutation = {
      ...valid,
      elements: copiedElements,
    } as Parameters<typeof buildEvidenceCertificateV2>[0]['consolidatedEvidence'];
    expect(() =>
      buildEvidenceCertificateV2({
        compiled,
        consolidatedEvidence: spreadMutation,
      }),
    ).toThrow('UNVALIDATED_CONSOLIDATED_EVIDENCE');

    expect(() => {
      required(valid.elements.at(0)).frameworkKey = null;
    }).toThrow();
  });

  it('requires structured contradictions and rejects stray framework bindings', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-framework-choice': {
              conflicts: [],
              status: 'CONTRADICTED',
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('CONTRADICTED_REQUIRES_STRUCTURED_CONFLICT');

    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-dossier-fact-1': { frameworkKey: 'PICO' },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('UNEXPECTED_FRAMEWORK_BINDING');
  });

  it('rejects a trusted claim attached to the wrong scenario', () => {
    const compiled = compileExecutableRubricV2(loadRubricV2());
    expect(() =>
      consolidateIndependentEvidenceV2({
        compiled,
        falsifier: evidencePassV2({ compiled, role: 'EVIDENCE_FALSIFIER' }),
        researcher: evidencePassV2({
          compiled,
          overrides: {
            'project-a-dossier-fact-1': {
              trustedClaimKeys: ['b-qualitative-interviews'],
            },
          },
          role: 'EVIDENCE_RESEARCHER',
        }),
        responseText,
      }),
    ).toThrow('TRUSTED_CLAIM_SCENARIO_MISMATCH');
  });
});
