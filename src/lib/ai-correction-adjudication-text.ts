/**
 * The verifier's input unit (V4.5-210).
 *
 * The sentence envelope is the production contract, not a presentation fix: a
 * verifier is asked about the smallest set of whole sentences containing the
 * material, never a bare fragment. Adjudication and the runner must therefore
 * share one segmenter, one set of offsets and one set of sentence identifiers —
 * otherwise the gold label answers a different question from the measurement.
 *
 * By stratum:
 *  - S1–S3  the minimal sentence envelope containing the quote;
 *  - S4–S6  the tuple of sentences bound to the atom's roles;
 *  - S7     the whole response.
 *
 * The exact quoted fragment is kept, and measured separately as a citation
 * fidelity endpoint. It is never the verifier's input.
 */
import { createHash } from 'node:crypto';

import { segmentSentences } from './ai-correction-regression-text.js';

/** Bumped whenever segmentation changes; frozen artefacts carry it. */
export const ADJUDICATION_SEGMENTER_VERSION = 'fr/segmentSentences@1';

export type AdjudicationSentence = {
  end: number;
  id: string;
  sha: string;
  start: number;
};

export type AdjudicationSegmentation = {
  responseSha: string;
  segmenterVersion: string;
  sentences: AdjudicationSentence[];
};

export type VerifierInputKind = 'ENVELOPE' | 'FULL_RESPONSE' | 'TUPLE';

export type VerifierInput = {
  kind: VerifierInputKind;
  sentenceIds: string[];
  text: string;
};

const sha16 = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 16);

/** The frozen segmentation of one response. Identifiers are positional. */
export function segmentForAdjudication(text: string): AdjudicationSegmentation {
  return {
    responseSha: sha16(text),
    segmenterVersion: ADJUDICATION_SEGMENTER_VERSION,
    sentences: segmentSentences({ locale: 'fr', text }).map(
      (sentence, index) => ({
        end: sentence.end,
        id: `s${index}`,
        sha: sha16(text.slice(sentence.start, sentence.end)),
        start: sentence.start,
      }),
    ),
  };
}

/**
 * The smallest run of whole sentences containing `fragment`.
 *
 * Returns null when the fragment is not in the text: a caller must decide what
 * that means rather than receive a silently truncated envelope.
 */
export function envelopeFor(input: {
  fragment: string;
  segmentation: AdjudicationSegmentation;
  text: string;
}): (VerifierInput & { end: number; start: number }) | null {
  const start = input.text.indexOf(input.fragment);
  if (start < 0) return null;
  const end = start + input.fragment.length;
  const covering = input.segmentation.sentences.filter(
    (sentence) => sentence.start < end && sentence.end > start,
  );
  if (covering.length === 0) return null;
  const from = Math.min(...covering.map((sentence) => sentence.start));
  const to = Math.max(...covering.map((sentence) => sentence.end));
  return {
    end: to,
    kind: 'ENVELOPE',
    sentenceIds: covering.map((sentence) => sentence.id),
    start: from,
    text: input.text.slice(from, to).trim(),
  };
}

const ENVELOPE_STRATA = new Set([
  'S1_span_local',
  'S2_span_frame',
  'S3_span_dossier',
]);
const TUPLE_STRATA = new Set([
  'S4_multi_local',
  'S5_multi_frame',
  'S6_multi_dossier',
]);

/**
 * What the verifier is actually shown, decided by the stratum alone.
 *
 * A tuple stratum needs the sentences adjudication bound to the atom's roles;
 * without them the caller gets null rather than a quietly narrower question.
 */
export function verifierInputFor(input: {
  fragment: string;
  responseText: string;
  roleSentenceIds?: string[];
  segmentation?: AdjudicationSegmentation;
  stratum: string;
}): VerifierInput | null {
  const segmentation =
    input.segmentation ?? segmentForAdjudication(input.responseText);
  if (segmentation.responseSha !== sha16(input.responseText)) return null;

  if (ENVELOPE_STRATA.has(input.stratum)) {
    return envelopeFor({
      fragment: input.fragment,
      segmentation,
      text: input.responseText,
    });
  }
  if (TUPLE_STRATA.has(input.stratum)) {
    const ids = input.roleSentenceIds ?? [];
    if (ids.length === 0) return null;
    const chosen = segmentation.sentences.filter((sentence) =>
      ids.includes(sentence.id),
    );
    if (chosen.length !== new Set(ids).size) return null;
    return {
      kind: 'TUPLE',
      sentenceIds: chosen.map((sentence) => sentence.id),
      text: chosen
        .map((sentence) =>
          input.responseText.slice(sentence.start, sentence.end).trim(),
        )
        .join(' '),
    };
  }
  if (input.stratum === 'S7_full_dossier') {
    return {
      kind: 'FULL_RESPONSE',
      sentenceIds: segmentation.sentences.map((sentence) => sentence.id),
      text: input.responseText,
    };
  }
  return null;
}
