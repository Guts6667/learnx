/**
 * Compiles the V4.5-122 domain cases into a benchmark corpus.
 *
 * The contracts are **not** transcribed into the corpus by hand. They are built
 * by `buildExerciseCorrectionArchetype`, the same function the server calls for
 * a real exercise, from the real lesson metadata in `content/<programme>/specs/*.json`.
 * That is what makes these cases a test of the archetype actually served rather
 * than of a copy that drifts from it: change the archetype and this corpus
 * changes with it, loudly, through the contract fingerprint.
 *
 * Two things are derived rather than authored, because authoring them by hand
 * is how a corpus acquires quiet inconsistencies:
 *
 * - `expectedSecondPass`, from the weighted score against the contract's own
 *   passing score;
 * - each `SENTENCE_DELETION` hint's `sentenceIndex`, resolved from an authored
 *   text anchor through the same segmenter the mutant generator uses, so an
 *   index can never drift from the sentence it was meant to name.
 */

import { z } from 'zod';

import {
  buildExerciseCorrectionArchetype,
  PRODUCTIVE_EXERCISE_ACTIVITY_TYPES,
  type ProductiveExerciseActivityType,
} from './exercise-correction-contracts.js';
import type { CorrectionContract } from './ai-correction-contracts.js';
import { correctionBenchmarkCorpusSchema } from './ai-correction-benchmark-corpus.js';
import type { CorrectionBenchmarkCorpus } from './ai-correction-benchmark.js';
import type { RegressionMutationHint } from './ai-correction-regression-pool.js';
import { segmentSentences } from './ai-correction-regression-text.js';

/**
 * Half-width of the band around the passing score inside which a correction is
 * routed to a second pass. Mirrors the ±5 convention of the sealed writing
 * corpus rather than inventing a new one.
 */
const SECOND_PASS_GUARD_BAND_POINTS = 5;

const authoredHintSchema = z.discriminatedUnion('kind', [
  z
    .object({
      criterionKey: z.string().trim().min(1),
      kind: z.literal('SENTENCE_DELETION'),
      /** A distinctive fragment of the sentence to delete. */
      sentenceAnchor: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      criterionKey: z.string().trim().min(1),
      kind: z.literal('FACT_INVERSION'),
      replace: z
        .object({ from: z.string().min(1), to: z.string().min(1) })
        .strict(),
    })
    .strict(),
]);

const authoredArchetypeSchema = z
  .object({
    activityKey: z.string().trim().min(1),
    activityType: z.enum(PRODUCTIVE_EXERCISE_ACTIVITY_TYPES),
    id: z.string().trim().min(1),
    instructions: z.string().trim().min(1),
    lessonObjectives: z.array(z.string().trim().min(1)).min(1),
    lessonSlug: z.string().trim().min(1),
    lessonSummary: z.string().trim().min(1),
    programSlug: z.string().trim().min(1),
    taskContext: z.string().trim().min(1),
    title: z.string().trim().min(1),
  })
  .strict();

const authoredCaseSchema = z
  .object({
    allowedEvidenceQuotes: z.array(z.string().trim().min(1)).optional(),
    archetypeId: z.string().trim().min(1),
    attackText: z.string().trim().min(1).optional(),
    caseId: z.string().trim().min(1),
    category: z.enum([
      'SUCCESSFUL',
      'PARTIAL',
      'ERRONEOUS',
      'AMBIGUOUS',
      'OFF_TOPIC',
      'PROMPT_INJECTION',
    ]),
    expectedLevels: z.record(z.string(), z.string()),
    forbiddenOutputFragments: z.array(z.string().trim().min(1)).optional(),
    goldRationale: z.string().trim().min(1),
    legitimateResponseText: z.string().trim().min(1).optional(),
    mutationHints: z.array(authoredHintSchema).default([]),
    responseText: z.string().trim().min(1).optional(),
  })
  .strict();

const authoredDomainCorpusSchema = z
  .object({
    archetypes: z.array(authoredArchetypeSchema).min(1),
    cases: z.array(authoredCaseSchema).min(1),
    corpusId: z.string().trim().min(1),
    language: z.string().trim().min(1),
    provenance: z.record(z.string(), z.string()),
    schemaVersion: z.literal(1),
  })
  .strict();

export type AuthoredDomainCorpus = z.infer<typeof authoredDomainCorpusSchema>;

export function parseAuthoredDomainCorpus(
  source: unknown,
): AuthoredDomainCorpus {
  return authoredDomainCorpusSchema.parse(source);
}

export class DomainCorpusError extends Error {}

/** Builds the archetype contract of one authored task, via production code. */
export function buildArchetypeContract(
  archetype: AuthoredDomainCorpus['archetypes'][number],
): CorrectionContract {
  return buildExerciseCorrectionArchetype({
    activityKey: archetype.activityKey,
    activityType: archetype.activityType as ProductiveExerciseActivityType,
    instructions: archetype.instructions,
    language: 'fr-FR',
    lessonObjectives: archetype.lessonObjectives,
    lessonSlug: archetype.lessonSlug,
    lessonSummary: archetype.lessonSummary,
    programSlug: archetype.programSlug,
    title: archetype.title,
  });
}

/** The weighted score a set of levels produces under a contract. */
export function weightedScore(input: {
  contract: CorrectionContract;
  levels: Record<string, string>;
}): number {
  return (
    input.contract.criteria.reduce((total, criterion) => {
      const levelKey = input.levels[criterion.key];
      const level = criterion.performanceLevels.find(
        (candidate) => candidate.key === levelKey,
      );
      if (!level) {
        throw new DomainCorpusError(
          `DOMAIN_LEVEL_UNKNOWN: ${criterion.key} = ${String(levelKey)}`,
        );
      }
      return total + criterion.weight * level.score;
    }, 0) / 100
  );
}

export type DomainBuildResult = {
  corpus: CorrectionBenchmarkCorpus;
  /** Resolved hints, keyed by benchmark case identifier. */
  hints: Map<string, RegressionMutationHint[]>;
};

export function buildDomainCorpus(
  authored: AuthoredDomainCorpus,
): DomainBuildResult {
  const contractsById = new Map(
    authored.archetypes.map((archetype) => [
      archetype.id,
      buildArchetypeContract(archetype),
    ]),
  );
  const archetypesById = new Map(
    authored.archetypes.map((archetype) => [archetype.id, archetype]),
  );

  const cases: CorrectionBenchmarkCorpus['cases'] = [];
  const hints = new Map<string, RegressionMutationHint[]>();

  for (const authoredCase of authored.cases) {
    const archetype = archetypesById.get(authoredCase.archetypeId);
    const contract = contractsById.get(authoredCase.archetypeId);
    if (!archetype || !contract) {
      throw new DomainCorpusError(
        `DOMAIN_ARCHETYPE_UNKNOWN: ${authoredCase.archetypeId}`,
      );
    }

    const responseText = resolveResponseText(authoredCase);
    const expectedCriteria = contract.criteria.map((criterion) => {
      const levelKey = authoredCase.expectedLevels[criterion.key];
      if (!levelKey) {
        throw new DomainCorpusError(
          `DOMAIN_LEVEL_MISSING: ${authoredCase.caseId} / ${criterion.key}`,
        );
      }
      return { criterionKey: criterion.key, levelKey };
    });

    const score = weightedScore({
      contract,
      levels: authoredCase.expectedLevels,
    });
    const distance = Math.abs(score - contract.passingScore);
    const required = distance <= SECOND_PASS_GUARD_BAND_POINTS;

    cases.push({
      caseId: authoredCase.caseId,
      category: authoredCase.category,
      contractKey: contract.contractKey,
      contractVersion: contract.version,
      expectedCriteria,
      expectedSecondPass: {
        rationale: required
          ? `Le score attendu de ${score} tombe dans la garde inclusive de ±${SECOND_PASS_GUARD_BAND_POINTS} autour du seuil de ${contract.passingScore}.`
          : `Le score attendu de ${score} est à ${distance} points du seuil de ${contract.passingScore}, donc hors de la garde inclusive de ±${SECOND_PASS_GUARD_BAND_POINTS}.`,
        required,
      },
      goldRationale: authoredCase.goldRationale,
      ...(authoredCase.category === 'PROMPT_INJECTION'
        ? {
            injectionSecurity: {
              allowedEvidenceQuotes: authoredCase.allowedEvidenceQuotes ?? [],
              attackText: authoredCase.attackText ?? '',
              forbiddenOutputFragments:
                authoredCase.forbiddenOutputFragments ?? [],
              legitimateResponseText: authoredCase.legitimateResponseText ?? '',
            },
          }
        : {}),
      responseText,
      taskContext: archetype.taskContext,
      taskPrompt: archetype.instructions,
    });

    const resolved = resolveHints({
      authoredCase,
      contract,
      language: authored.language,
      responseText,
    });
    if (resolved.length > 0) hints.set(authoredCase.caseId, resolved);
  }

  return {
    corpus: correctionBenchmarkCorpusSchema.parse({
      cases,
      contracts: [...contractsById.values()],
      corpusId: authored.corpusId,
      humanReview: { reviewedAt: null, reviewer: null, status: 'PENDING' },
      language: authored.language,
      schemaVersion: 1,
      syntheticOnly: true,
    }),
    hints,
  };
}

function resolveResponseText(
  authoredCase: AuthoredDomainCorpus['cases'][number],
): string {
  if (authoredCase.category !== 'PROMPT_INJECTION') {
    if (!authoredCase.responseText) {
      throw new DomainCorpusError(
        `DOMAIN_RESPONSE_MISSING: ${authoredCase.caseId}`,
      );
    }
    return authoredCase.responseText;
  }
  if (!authoredCase.legitimateResponseText || !authoredCase.attackText) {
    throw new DomainCorpusError(
      `DOMAIN_INJECTION_INCOMPLETE: ${authoredCase.caseId}`,
    );
  }
  // The corpus schema requires exactly this concatenation, so it is derived
  // here rather than authored twice and left to drift.
  return `${authoredCase.legitimateResponseText} ${authoredCase.attackText}`;
}

function resolveHints(input: {
  authoredCase: AuthoredDomainCorpus['cases'][number];
  contract: CorrectionContract;
  language: string;
  responseText: string;
}): RegressionMutationHint[] {
  const criterionKeys = new Set(
    input.contract.criteria.map((criterion) => criterion.key),
  );
  const sentences = segmentSentences({
    locale: input.language,
    text: input.responseText,
  });

  return input.authoredCase.mutationHints.map((hint) => {
    if (!criterionKeys.has(hint.criterionKey)) {
      throw new DomainCorpusError(
        `DOMAIN_HINT_CRITERION_UNKNOWN: ${input.authoredCase.caseId} / ${hint.criterionKey}`,
      );
    }
    if (hint.kind === 'FACT_INVERSION') {
      return {
        criterionKey: hint.criterionKey,
        kind: 'FACT_INVERSION' as const,
        replace: hint.replace,
      };
    }

    const matches = sentences.filter((sentence) =>
      sentence.text.includes(hint.sentenceAnchor),
    );
    if (matches.length !== 1) {
      throw new DomainCorpusError(
        `DOMAIN_HINT_ANCHOR_NOT_UNIQUE: ${input.authoredCase.caseId} / "${hint.sentenceAnchor}" matched ${matches.length} sentences`,
      );
    }
    return {
      criterionKey: hint.criterionKey,
      kind: 'SENTENCE_DELETION' as const,
      sentenceIndex: sentences.indexOf(
        matches[0] as (typeof sentences)[number],
      ),
    };
  });
}
