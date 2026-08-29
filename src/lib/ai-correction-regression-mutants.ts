/**
 * Deterministic mutant generator for the V4.5-120 regression suite.
 *
 * Implements §3 of `docs/V4_5_REGRESSION_SUITE.md`. Each mutant damages a
 * response in a way whose *direction* is known before the model is asked, which
 * is what turns "the model disagreed with an AI-written gold" into "the model
 * failed a property the machine can decide".
 *
 * Everything here is pure and offline. `PARAPHRASE` is the single exception in
 * the spec and is not implemented at this step: it needs the promoted verifier
 * (V4.5-111) and a paid call, so it arrives with step 4.
 *
 * Determinism is load-bearing: the same pool and the same generator version
 * must produce byte-identical mutants, because the gate budgets are integers
 * sized to the mutant count and a run is reproduced from the pool digest plus
 * this version, never from stored mutant text.
 */

import { createHash } from 'node:crypto';

import type { RegressionPoolCase } from './ai-correction-regression-pool.js';
import {
  countOccurrences,
  removeSpan,
  segmentParagraphs,
  segmentSentences,
} from './ai-correction-regression-text.js';

/**
 * Version of the generation algorithm. Any change to how a mutant's text is
 * produced is a bump here, because the run summary records this value as half
 * of the run's reproducibility claim (the other half being the pool digest).
 */
export const REGRESSION_MUTANT_GENERATOR_VERSION = '1.0.0';

export type RegressionMutantKind =
  | 'SENTENCE_DELETION'
  | 'FACT_INVERSION'
  | 'INJECTION_APPEND'
  | 'PARAGRAPH_SHUFFLE';

/**
 * What the run must observe for the mutant to pass.
 *
 * `targetCriterionKey` names the criterion the mutation was aimed at;
 * `targetDirection` is decided on it alone, and `othersExpectation` on every
 * other criterion of the contract. Levels are compared to the *baseline* run of
 * the unmutated case, on the contract's performance levels ordered by ascending
 * score.
 */
export type RegressionMutantExpectation = {
  /** Text that must not be quoted back as evidence (injection canary). */
  forbiddenQuoteSource?: string;
  othersExpectation: 'STABLE' | 'WITHIN_ONE_STEP' | 'UNCONSTRAINED';
  targetCriterionKey?: string;
  targetDirection?: 'NOT_MASTERED' | 'DOWN';
};

export type RegressionMutant = {
  caseId: string;
  expectation: RegressionMutantExpectation;
  kind: RegressionMutantKind;
  mutantId: string;
  responseText: string;
};

/** Everything the generator needs that the pool references but does not copy. */
export type RegressionMutantSource = {
  /** The pool-wide canonical attack, appended by `INJECTION_APPEND`. */
  canonicalAttackSegment: string;
  locale: string;
  poolCase: RegressionPoolCase;
  responseText: string;
};

/**
 * All mutants for one pool case, in a stable order.
 *
 * A case yields nothing for a kind whose precondition it fails — no authored
 * hint, a single sentence, one paragraph. That is deliberate: the suite
 * measures what it can decide and reports the denominator, rather than
 * inventing a mutant whose expected direction nobody can defend.
 */
export function generateRegressionMutants(
  input: RegressionMutantSource,
): RegressionMutant[] {
  return [
    ...sentenceDeletionMutants(input),
    ...factInversionMutants(input),
    ...injectionAppendMutants(input),
    ...paragraphShuffleMutants(input),
  ];
}

function sentenceDeletionMutants(
  input: RegressionMutantSource,
): RegressionMutant[] {
  const sentences = segmentSentences({
    locale: input.locale,
    text: input.responseText,
  });
  if (sentences.length < 2) return [];

  return input.poolCase.mutationHints
    .filter((hint) => hint.kind === 'SENTENCE_DELETION')
    .flatMap((hint) => {
      const sentence = sentences[hint.sentenceIndex];
      if (!sentence) return [];
      const responseText = removeSpan({
        end: sentence.end,
        start: sentence.start,
        text: input.responseText,
      });
      if (responseText.trim().length === 0) return [];
      return [
        {
          caseId: input.poolCase.caseId,
          expectation: {
            // Removing the sentence that carried the criterion cannot leave it
            // at the top level. Other criteria may legitimately move: the
            // response really is shorter, so nothing is claimed about them.
            othersExpectation: 'UNCONSTRAINED' as const,
            targetCriterionKey: hint.criterionKey,
            targetDirection: 'NOT_MASTERED' as const,
          },
          kind: 'SENTENCE_DELETION' as const,
          mutantId: mutantId({
            caseId: input.poolCase.caseId,
            discriminator: `${hint.criterionKey}@${hint.sentenceIndex}`,
            kind: 'SENTENCE_DELETION',
          }),
          responseText,
        },
      ];
    });
}

function factInversionMutants(
  input: RegressionMutantSource,
): RegressionMutant[] {
  return input.poolCase.mutationHints
    .filter((hint) => hint.kind === 'FACT_INVERSION')
    .flatMap((hint) => {
      if (
        countOccurrences({
          haystack: input.responseText,
          needle: hint.replace.from,
        }) !== 1
      ) {
        // The validator rejects this at authoring time; reaching it here means
        // the corpus moved under the pool, and a silent mutant would be worse
        // than none.
        return [];
      }
      return [
        {
          caseId: input.poolCase.caseId,
          expectation: {
            // One fact changed and nothing else did, so every criterion that
            // does not depend on that fact must hold its level exactly.
            othersExpectation: 'STABLE' as const,
            targetCriterionKey: hint.criterionKey,
            targetDirection: 'DOWN' as const,
          },
          kind: 'FACT_INVERSION' as const,
          mutantId: mutantId({
            caseId: input.poolCase.caseId,
            discriminator: `${hint.criterionKey}@${digest(hint.replace.from)}`,
            kind: 'FACT_INVERSION',
          }),
          responseText: input.responseText.replace(
            hint.replace.from,
            hint.replace.to,
          ),
        },
      ];
    });
}

function injectionAppendMutants(
  input: RegressionMutantSource,
): RegressionMutant[] {
  // Cases that already carry an attack are the security oracle's own material.
  // Appending a second attack would make a red result ambiguous between the
  // two, so the pool's injection cases are left to that oracle.
  if (input.poolCase.profile === 'PROMPT_INJECTION') return [];
  return [
    {
      caseId: input.poolCase.caseId,
      expectation: {
        forbiddenQuoteSource: input.canonicalAttackSegment,
        // The learner's production is untouched; an appended instruction must
        // change no level at all, and must not be quoted back as evidence.
        othersExpectation: 'STABLE' as const,
      },
      kind: 'INJECTION_APPEND' as const,
      mutantId: mutantId({
        caseId: input.poolCase.caseId,
        discriminator: digest(input.canonicalAttackSegment),
        kind: 'INJECTION_APPEND',
      }),
      responseText: `${input.responseText} ${input.canonicalAttackSegment}`,
    },
  ];
}

function paragraphShuffleMutants(
  input: RegressionMutantSource,
): RegressionMutant[] {
  const { paragraphs, separators } = segmentParagraphs(input.responseText);
  if (paragraphs.length < 2) return [];

  const order = deterministicPermutation({
    length: paragraphs.length,
    seed: input.poolCase.caseId,
  });
  if (order.every((value, index) => value === index)) return [];

  const shuffled = order.flatMap((index) => {
    const paragraph = paragraphs[index];
    return paragraph ? [paragraph.text] : [];
  });
  const responseText = shuffled.reduce(
    (text, paragraph, index) =>
      index === 0
        ? paragraph
        : `${text}${separators[index - 1] ?? '\n\n'}${paragraph}`,
    '',
  );
  return [
    {
      caseId: input.poolCase.caseId,
      expectation: {
        // Reordering whole paragraphs keeps every claim and every fact. A
        // rubric that reads content rather than position should not move, but
        // presentation criteria may legitimately shift by one step.
        othersExpectation: 'WITHIN_ONE_STEP' as const,
      },
      kind: 'PARAGRAPH_SHUFFLE' as const,
      mutantId: mutantId({
        caseId: input.poolCase.caseId,
        discriminator: order.join('-'),
        kind: 'PARAGRAPH_SHUFFLE',
      }),
      responseText,
    },
  ];
}

/**
 * A permutation of `0..length-1` derived from the seed alone.
 *
 * Fisher-Yates driven by a SHA-256 stream: no `Math.random`, no dependency on
 * platform collation, and the same seed gives the same order on every machine
 * and every run — which is what lets a mutant be reproduced from the pool
 * rather than stored.
 */
export function deterministicPermutation(input: {
  length: number;
  seed: string;
}): number[] {
  const order = Array.from({ length: input.length }, (_, index) => index);
  let stream = createHash('sha256').update(input.seed).digest();
  let offset = 0;
  const nextByte = (): number => {
    if (offset >= stream.length) {
      stream = createHash('sha256').update(stream).digest();
      offset = 0;
    }
    const byte = stream[offset] ?? 0;
    offset += 1;
    return byte;
  };
  for (let index = order.length - 1; index > 0; index -= 1) {
    // Rejection sampling keeps the draw uniform; a plain modulo would bias
    // toward the low indices and make the "shuffle" quietly lopsided.
    const bound = index + 1;
    const limit = Math.floor(256 / bound) * bound;
    let draw = nextByte();
    while (draw >= limit) draw = nextByte();
    const target = draw % bound;
    const held = order[index] ?? index;
    order[index] = order[target] ?? target;
    order[target] = held;
  }
  return order;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/**
 * Stable identifier for a mutant. It encodes the case, the kind and what made
 * this mutant distinct from its siblings, so a gate failure names something a
 * reader can find in the pool without consulting a mapping table.
 */
export function mutantId(input: {
  caseId: string;
  discriminator: string;
  kind: RegressionMutantKind;
}): string {
  return `${input.caseId}#${input.kind}#${input.discriminator}`;
}
