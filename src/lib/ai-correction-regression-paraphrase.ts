/**
 * The `PARAPHRASE` oracle's cache (V4.5-120 step 4, spec §3).
 *
 * Paraphrase is the one mutant kind whose input is itself a model output: the
 * verifier rewrites a response with the same meaning, and a rubric that reads
 * content rather than wording should not move by more than a step. That makes
 * it the weakest oracle in the suite, and the one most in need of discipline:
 *
 * - it is **cached and frozen per pool version**, never regenerated per
 *   promotion, so two promotions stay comparable on it (owner decision,
 *   29 August 2026). A pool v2 gets its own directory and v1's is never
 *   rewritten — `benchmarks/**` is append-only;
 * - every entry records the SHA-256 of the response it paraphrased and the
 *   generator version, so a cache that no longer matches its source is
 *   detected rather than silently reused;
 * - an entry only exists if the verifier answered the closed question "does
 *   this preserve the meaning" affirmatively. An unverified paraphrase is not
 *   written, so the pool never carries one nobody checked.
 *
 * Generation costs money and therefore happens inside V4.5-121's authorised
 * run, under its single reconciled budget. Everything in this module is pure
 * and offline; the paid part arrives through `ParaphrasePort`.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';

import { REGRESSION_MUTANT_GENERATOR_VERSION } from './ai-correction-regression-mutants.js';

const PARAPHRASE_CACHE_SCHEMA_VERSION = 1;

const paraphraseCacheEntrySchema = z
  .object({
    caseId: z.string().trim().min(1),
    /** Identity of the verifier that produced and validated the rewrite. */
    checkerModelId: z.string().trim().min(1),
    generatedAt: z.iso.datetime({ offset: true }),
    /** Generator version in force when the entry was written. */
    generatorVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    paraphraseText: z.string().trim().min(1),
    poolId: z.string().trim().min(1),
    schemaVersion: z.literal(PARAPHRASE_CACHE_SCHEMA_VERSION),
    /** SHA-256 of the exact response text that was paraphrased. */
    sourceResponseSha256: z.string().regex(/^[0-9a-f]{64}$/),
    /**
     * Always true: an entry is only written after the verifier confirmed the
     * meaning survived. The field is recorded rather than implied so a reader
     * of the artefact can see the claim being made.
     */
    verifiedSameMeaning: z.literal(true),
  })
  .strict();

export type ParaphraseCacheEntry = z.infer<typeof paraphraseCacheEntrySchema>;

export function parseParaphraseCacheEntry(
  source: unknown,
): ParaphraseCacheEntry {
  return paraphraseCacheEntrySchema.parse(source);
}

/**
 * Path of a cached paraphrase, relative to the regression directory.
 *
 * Nested under the pool identifier so a new pool version never touches an
 * older one's entries, and under the case identifier's own segments so the
 * file sits where a reader would look for it.
 */
export function paraphraseCachePath(input: {
  caseId: string;
  poolId: string;
}): string {
  return `paraphrases/${input.poolId}/${input.caseId}.json`;
}

/** SHA-256 of a response, as recorded on a cache entry. */
export function responseDigest(responseText: string): string {
  return createHash('sha256').update(responseText).digest('hex');
}

export type ParaphraseCacheVerdict =
  { reason: string; usable: false } | { usable: true };

/**
 * Whether a cached paraphrase may still be used for this case.
 *
 * Refuses rather than repairs: a stale entry means the corpus or the generator
 * moved, and reusing it would silently compare a run against a paraphrase of
 * text that no longer exists.
 */
export function checkParaphraseCacheEntry(input: {
  caseId: string;
  entry: ParaphraseCacheEntry;
  generatorVersion?: string;
  poolId: string;
  responseText: string;
}): ParaphraseCacheVerdict {
  const expectedVersion =
    input.generatorVersion ?? REGRESSION_MUTANT_GENERATOR_VERSION;
  if (input.entry.caseId !== input.caseId) {
    return {
      reason: `L'entrée concerne ${input.entry.caseId}, pas ${input.caseId}.`,
      usable: false,
    };
  }
  if (input.entry.poolId !== input.poolId) {
    return {
      reason: `L'entrée appartient au pool ${input.entry.poolId}, pas à ${input.poolId}.`,
      usable: false,
    };
  }
  const digest = responseDigest(input.responseText);
  if (input.entry.sourceResponseSha256 !== digest) {
    return {
      reason:
        'La réponse source a changé depuis la mise en cache ; la paraphrase ne la reformule plus.',
      usable: false,
    };
  }
  if (input.entry.generatorVersion !== expectedVersion) {
    return {
      reason: `Paraphrase produite par le générateur ${input.entry.generatorVersion}, incompatible avec ${expectedVersion}.`,
      usable: false,
    };
  }
  if (input.entry.paraphraseText.trim() === input.responseText.trim()) {
    return {
      reason: 'La paraphrase est identique à la réponse : elle ne teste rien.',
      usable: false,
    };
  }
  return { usable: true };
}

/**
 * The paid half of the oracle, injected by V4.5-121.
 *
 * Two steps, deliberately separate: rewriting is a generation task, and
 * deciding whether the meaning survived is a closed question. Letting one call
 * do both would let the model grade its own rewrite.
 */
export interface ParaphrasePort {
  /** Rewrites the response with the same meaning. */
  paraphrase(input: {
    caseId: string;
    responseText: string;
  }): Promise<{ modelId: string; paraphraseText: string }>;
  /** Closed question: does the rewrite preserve the meaning? */
  confirmSameMeaning(input: {
    caseId: string;
    paraphraseText: string;
    responseText: string;
  }): Promise<boolean>;
}

export type ParaphraseGenerationOutcome =
  | { caseId: string; entry: ParaphraseCacheEntry; status: 'GENERATED' }
  | { caseId: string; reason: string; status: 'REJECTED' };

/**
 * Produces a cache entry for one case, or refuses to.
 *
 * A rewrite the verifier will not confirm is dropped, not stored with a
 * caveat: the suite would rather measure fewer mutants than measure one whose
 * premise is unchecked.
 */
export async function generateParaphraseCacheEntry(input: {
  caseId: string;
  generatedAt: string;
  generatorVersion?: string;
  poolId: string;
  port: ParaphrasePort;
  responseText: string;
}): Promise<ParaphraseGenerationOutcome> {
  const { modelId, paraphraseText } = await input.port.paraphrase({
    caseId: input.caseId,
    responseText: input.responseText,
  });

  if (paraphraseText.trim() === input.responseText.trim()) {
    return {
      caseId: input.caseId,
      reason: 'Le modèle a renvoyé la réponse inchangée.',
      status: 'REJECTED',
    };
  }

  const confirmed = await input.port.confirmSameMeaning({
    caseId: input.caseId,
    paraphraseText,
    responseText: input.responseText,
  });
  if (!confirmed) {
    return {
      caseId: input.caseId,
      reason: "Le vérificateur n'a pas confirmé que le sens était préservé.",
      status: 'REJECTED',
    };
  }

  return {
    caseId: input.caseId,
    entry: paraphraseCacheEntrySchema.parse({
      caseId: input.caseId,
      checkerModelId: modelId,
      generatedAt: input.generatedAt,
      generatorVersion:
        input.generatorVersion ?? REGRESSION_MUTANT_GENERATOR_VERSION,
      paraphraseText,
      poolId: input.poolId,
      schemaVersion: PARAPHRASE_CACHE_SCHEMA_VERSION,
      sourceResponseSha256: responseDigest(input.responseText),
      verifiedSameMeaning: true,
    }),
    status: 'GENERATED',
  };
}
