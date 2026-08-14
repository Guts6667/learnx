import { createHash } from 'node:crypto';

import { z } from 'zod';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const criterionKeySchema = z.enum([
  'decision-position',
  'evidence-fidelity',
  'reasoning-link',
]);

const levelKeySchema = z.enum(['insufficient', 'partial', 'mastered']);

const metamorphismSchema = z.enum([
  'BASELINE',
  'PARAPHRASE_INVARIANT',
  'CONCISION_INVARIANT',
  'TYPOGRAPHY_UNICODE_INVARIANT',
  'SINGLE_CRITERION_DECISION_MUTATION',
  'SINGLE_CRITERION_EVIDENCE_MUTATION',
  'SINGLE_CRITERION_REASONING_MUTATION',
  'CONTRADICTION_OWNER_MUTATION',
  'DIRECT_PROMPT_INJECTION',
  'UNICODE_PROMPT_INJECTION',
]);

const expectedCriterionSchema = z
  .object({
    criterionKey: criterionKeySchema,
    levelKey: levelKeySchema,
    rationale: z.string().trim().min(1),
  })
  .strict();

const injectionBoundarySchema = z
  .object({
    attackText: z.string().trim().min(1),
    forbiddenOutputFragments: z.array(z.string().trim().min(1)).min(1),
    legitimateResponseText: z.string().trim().min(1),
  })
  .strict();

const autonomousCaseSchema = z
  .object({
    caseDigest: sha256Schema,
    caseId: stableKeySchema,
    expectedCriteria: z.array(expectedCriterionSchema).length(3),
    expectedDisposition: z.enum(['CONFIRMED', 'UNCERTAIN', 'UNUSABLE']),
    expectedEvidenceQuotes: z.array(z.string().trim().min(1)).min(1),
    injectionBoundary: injectionBoundarySchema.optional(),
    metamorphism: metamorphismSchema,
    metamorphicParentCaseId: stableKeySchema.nullable(),
    oracleRationale: z.string().trim().min(1),
    ownedDefects: z.array(criterionKeySchema),
    responseText: z.string().trim().min(1),
    taskContext: z.string().trim().min(1),
    taskPrompt: z.string().trim().min(1),
  })
  .strict();

const autonomousContractSnapshotSchema = z
  .object({
    contractKey: z.literal('v4-writing-recommendation-fr'),
    criteria: z
      .array(
        z
          .object({
            key: criterionKeySchema,
            levels: z.array(levelKeySchema).length(3),
            penaltyOwner: z.boolean(),
            weight: z.number().int().positive(),
          })
          .strict(),
      )
      .length(3),
    lifecycle: z.literal('DRAFT_NOT_PUBLISHED'),
    version: z.literal('0.1.0-draft'),
  })
  .strict();

export const autonomousFormativeCorpusSchema = z
  .object({
    cases: z.array(autonomousCaseSchema).length(10),
    contract: autonomousContractSnapshotSchema,
    corpusId: stableKeySchema,
    corpusKind: z.literal('DEVELOPMENT_MINI_PANEL'),
    executionPlan: z
      .object({
        expectedLogicalWorkflows: z.literal(20),
        repetitionsPerCase: z.literal(2),
      })
      .strict(),
    gate: z.literal('GO_AUTONOMOUS_FORMATIVE'),
    language: z.literal('fr-FR'),
    oracleDigest: sha256Schema,
    oracleType: z.literal('SEALED_AUTONOMOUS'),
    schemaVersion: z.literal(1),
    syntheticOnly: z.literal(true),
  })
  .strict()
  .superRefine((corpus, context) => {
    const caseIds = new Set<string>();
    const metamorphisms = new Set<string>();
    const expectedCriteria = new Set(corpus.contract.criteria.map(({ key }) => key));

    if (corpus.contract.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) !== 100) {
      context.addIssue({ code: 'custom', message: 'Contract weights must total 100.', path: ['contract', 'criteria'] });
    }

    corpus.cases.forEach((benchmarkCase, caseIndex) => {
      if (caseIds.has(benchmarkCase.caseId)) {
        context.addIssue({ code: 'custom', message: 'Case identifiers must be unique.', path: ['cases', caseIndex, 'caseId'] });
      }
      caseIds.add(benchmarkCase.caseId);
      metamorphisms.add(benchmarkCase.metamorphism);

      const actualCriteria = new Set(benchmarkCase.expectedCriteria.map(({ criterionKey }) => criterionKey));
      if (actualCriteria.size !== 3 || [...expectedCriteria].some((key) => !actualCriteria.has(key))) {
        context.addIssue({ code: 'custom', message: 'Every case must declare each contract criterion exactly once.', path: ['cases', caseIndex, 'expectedCriteria'] });
      }

      benchmarkCase.expectedEvidenceQuotes.forEach((quote, quoteIndex) => {
        if (!benchmarkCase.responseText.includes(quote)) {
          context.addIssue({ code: 'custom', message: 'Expected evidence quotes must be exact response substrings.', path: ['cases', caseIndex, 'expectedEvidenceQuotes', quoteIndex] });
        }
      });

      const hasInjection = benchmarkCase.metamorphism === 'DIRECT_PROMPT_INJECTION' || benchmarkCase.metamorphism === 'UNICODE_PROMPT_INJECTION';
      if (hasInjection !== Boolean(benchmarkCase.injectionBoundary)) {
        context.addIssue({ code: 'custom', message: 'Injection metamorphisms require an injection boundary and only they may define one.', path: ['cases', caseIndex, 'injectionBoundary'] });
      }
      if (benchmarkCase.injectionBoundary) {
        const expected = `${benchmarkCase.injectionBoundary.legitimateResponseText} ${benchmarkCase.injectionBoundary.attackText}`;
        if (benchmarkCase.responseText !== expected) {
          context.addIssue({ code: 'custom', message: 'Injection responses must concatenate legitimate and attack segments exactly once.', path: ['cases', caseIndex, 'responseText'] });
        }
        benchmarkCase.expectedEvidenceQuotes.forEach((quote, quoteIndex) => {
          if (!benchmarkCase.injectionBoundary?.legitimateResponseText.includes(quote)) {
            context.addIssue({ code: 'custom', message: 'Expected evidence must remain inside the legitimate segment.', path: ['cases', caseIndex, 'expectedEvidenceQuotes', quoteIndex] });
          }
        });
      }
    });

    corpus.cases.forEach((benchmarkCase, caseIndex) => {
      if (benchmarkCase.metamorphicParentCaseId && !caseIds.has(benchmarkCase.metamorphicParentCaseId)) {
        context.addIssue({ code: 'custom', message: 'Metamorphic parent must exist in the same corpus.', path: ['cases', caseIndex, 'metamorphicParentCaseId'] });
      }
    });

    const required = metamorphismSchema.options;
    required.forEach((metamorphism) => {
      if (!metamorphisms.has(metamorphism)) {
        context.addIssue({ code: 'custom', message: `Missing metamorphism ${metamorphism}.`, path: ['cases'] });
      }
    });
  });

export type AutonomousFormativeCorpus = z.infer<typeof autonomousFormativeCorpusSchema>;

export function parseAutonomousFormativeCorpus(input: unknown): AutonomousFormativeCorpus {
  return autonomousFormativeCorpusSchema.parse(input);
}

export function sha256Canonical(input: unknown): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonicalize(entry)]),
      );
    }
    return value;
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalize(input)))
    .digest('hex');
}

export function autonomousCaseDigest(
  input: unknown,
): string {
  return sha256Canonical(input);
}

export function autonomousOracleDigest(
  cases: Array<{
    caseDigest: string;
    expectedCriteria: Array<z.infer<typeof expectedCriterionSchema>>;
    expectedDisposition: 'CONFIRMED' | 'UNCERTAIN' | 'UNUSABLE';
    oracleRationale: string;
    ownedDefects: Array<z.infer<typeof criterionKeySchema>>;
  }>,
): string {
  return sha256Canonical(
    cases.map(({ caseDigest, expectedCriteria, expectedDisposition, oracleRationale, ownedDefects }) => ({
      caseDigest,
      expectedCriteria,
      expectedDisposition,
      oracleRationale,
      ownedDefects,
    })),
  );
}
