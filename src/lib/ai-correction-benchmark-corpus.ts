import { z } from 'zod';
import { correctionContractSchema } from './ai-correction-contracts.js';

export const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const languageTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .refine((value) => {
    try {
      return Intl.getCanonicalLocales(value)[0] === value;
    } catch {
      return false;
    }
  }, 'Language must be a canonical BCP 47 tag such as fr-FR or en-GB.');

export const benchmarkResponseCategorySchema = z.enum([
  'SUCCESSFUL',
  'PARTIAL',
  'ERRONEOUS',
  'AMBIGUOUS',
  'OFF_TOPIC',
  'PROMPT_INJECTION',
]);

const benchmarkReviewSchema = z.discriminatedUnion('status', [
  z
    .object({
      reviewedAt: z.null(),
      reviewer: z.null(),
      status: z.literal('PENDING'),
    })
    .strict(),
  z
    .object({
      reviewedAt: z.iso.datetime({ offset: true }),
      reviewer: z.string().trim().min(1),
      status: z.literal('APPROVED'),
    })
    .strict(),
]);

const expectedCriterionSchema = z
  .object({
    criterionKey: stableKeySchema,
    levelKey: stableKeySchema,
  })
  .strict();

const expectedSecondPassSchema = z
  .object({
    rationale: z.string().trim().min(1),
    required: z.boolean(),
  })
  .strict();

const injectionSecuritySchema = z
  .object({
    allowedEvidenceQuotes: z.array(z.string().trim().min(1)).min(1),
    attackText: z.string().trim().min(1),
    forbiddenOutputFragments: z.array(z.string().trim().min(1)).min(1),
    legitimateResponseText: z.string().trim().min(1),
  })
  .strict();

const benchmarkCaseSchema = z
  .object({
    caseId: stableKeySchema,
    category: benchmarkResponseCategorySchema,
    contractKey: stableKeySchema,
    contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    expectedCriteria: z.array(expectedCriterionSchema).min(1),
    expectedSecondPass: expectedSecondPassSchema,
    goldRationale: z.string().trim().min(1),
    injectionSecurity: injectionSecuritySchema.optional(),
    responseText: z.string().trim().min(1),
    taskContext: z.string().trim().min(1),
    taskPrompt: z.string().trim().min(1),
  })
  .strict();

export const correctionBenchmarkCorpusSchema = z
  .object({
    cases: z.array(benchmarkCaseSchema).min(1),
    contracts: z.array(correctionContractSchema).min(1),
    corpusId: stableKeySchema,
    humanReview: benchmarkReviewSchema,
    language: languageTagSchema,
    schemaVersion: z.literal(1),
    syntheticOnly: z.literal(true),
  })
  .strict()
  .superRefine((corpus, context) => {
    const contractsById = new Map(
      corpus.contracts.map((contract) => [
        `${contract.contractKey}@${contract.version}`,
        contract,
      ]),
    );
    const caseIds = new Set<string>();

    corpus.cases.forEach((benchmarkCase, caseIndex) => {
      if (caseIds.has(benchmarkCase.caseId)) {
        context.addIssue({
          code: 'custom',
          message: 'Benchmark case identifiers must be unique.',
          path: ['cases', caseIndex, 'caseId'],
        });
      }
      caseIds.add(benchmarkCase.caseId);

      const contract = contractsById.get(
        `${benchmarkCase.contractKey}@${benchmarkCase.contractVersion}`,
      );
      if (!contract) {
        context.addIssue({
          code: 'custom',
          message: 'Benchmark case references an unknown contract.',
          path: ['cases', caseIndex, 'contractKey'],
        });
        return;
      }

      const expectedByCriterion = new Map(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          criterion.levelKey,
        ]),
      );
      if (
        expectedByCriterion.size !== contract.criteria.length ||
        benchmarkCase.expectedCriteria.length !== contract.criteria.length
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Every contract criterion must have one expected level.',
          path: ['cases', caseIndex, 'expectedCriteria'],
        });
      }

      contract.criteria.forEach((criterion) => {
        const expectedLevel = expectedByCriterion.get(criterion.key);
        if (
          !expectedLevel ||
          !criterion.performanceLevels.some(
            (level) => level.key === expectedLevel,
          )
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Expected level must belong to the referenced criterion.',
            path: ['cases', caseIndex, 'expectedCriteria'],
          });
        }
      });

      if (benchmarkCase.category === 'PROMPT_INJECTION') {
        if (!benchmarkCase.injectionSecurity) {
          context.addIssue({
            code: 'custom',
            message:
              'Prompt injection cases require deterministic security boundaries.',
            path: ['cases', caseIndex, 'injectionSecurity'],
          });
          return;
        }
        const expectedResponse = `${benchmarkCase.injectionSecurity.legitimateResponseText} ${benchmarkCase.injectionSecurity.attackText}`;
        if (benchmarkCase.responseText !== expectedResponse) {
          context.addIssue({
            code: 'custom',
            message:
              'Prompt injection response must concatenate the legitimate response and attack exactly once.',
            path: ['cases', caseIndex, 'responseText'],
          });
        }
        benchmarkCase.injectionSecurity.allowedEvidenceQuotes.forEach(
          (quote, quoteIndex) => {
            if (
              !benchmarkCase.injectionSecurity?.legitimateResponseText.includes(
                quote,
              )
            ) {
              context.addIssue({
                code: 'custom',
                message:
                  'Allowed evidence must come from the legitimate response segment.',
                path: [
                  'cases',
                  caseIndex,
                  'injectionSecurity',
                  'allowedEvidenceQuotes',
                  quoteIndex,
                ],
              });
            }
          },
        );
      } else if (benchmarkCase.injectionSecurity) {
        context.addIssue({
          code: 'custom',
          message:
            'Injection security boundaries are reserved for prompt injection cases.',
          path: ['cases', caseIndex, 'injectionSecurity'],
        });
      }
    });
  });

export type CorrectionBenchmarkCorpus = z.infer<
  typeof correctionBenchmarkCorpusSchema
>;
