import type {
  CorrectionOutput,
  Protocol3CorrectionArtifactOutput,
} from './ai-correction-contracts.js';
import type { EvidenceMatch } from './ai-correction-benchmark-artifacts.js';

type BenchmarkCorrectionOutput =
  CorrectionOutput | Protocol3CorrectionArtifactOutput;
type ResolvedTextEvidence = {
  matchType: 'EXACT' | 'TYPOGRAPHIC_EQUIVALENT';
  resolvedQuote: string;
};

export interface CorrectionEvidenceContext {
  responseText: string;
  category?: string;
  injectionSecurity?: {
    attackText: string;
    forbiddenOutputFragments: string[];
    legitimateResponseText: string;
  };
}

export function normalizeTypographicSegment(segment: string): string {
  return segment
    .normalize('NFC')
    .replaceAll('\r\n', '\n')
    .replaceAll(/[\u00a0\u202f]/g, ' ')
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u00ab\u00bb\u201c\u201d]/g, '"');
}

function normalizedTextWithOffsets(text: string): {
  normalized: string;
  originalEnds: number[];
  originalStarts: number[];
} {
  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
  const normalizedParts: string[] = [];
  const originalStarts: number[] = [];
  const originalEnds: number[] = [];

  for (const part of segmenter.segment(text)) {
    const normalizedPart = normalizeTypographicSegment(part.segment);
    normalizedParts.push(normalizedPart);
    for (let index = 0; index < normalizedPart.length; index += 1) {
      originalStarts.push(part.index);
      originalEnds.push(part.index + part.segment.length);
    }
  }
  return {
    normalized: normalizedParts.join(''),
    originalEnds,
    originalStarts,
  };
}

function occurrenceIndexes(text: string, search: string): number[] {
  const indexes: number[] = [];
  let fromIndex = 0;
  while (fromIndex <= text.length - search.length) {
    const index = text.indexOf(search, fromIndex);
    if (index === -1) {
      break;
    }
    indexes.push(index);
    fromIndex = index + 1;
  }
  return indexes;
}

export function resolveBenchmarkEvidenceQuote(input: {
  quote: string;
  responseText: string;
}): ResolvedTextEvidence {
  const response = normalizedTextWithOffsets(input.responseText);
  const normalizedQuote = normalizeTypographicSegment(input.quote);
  const normalizedMatches = occurrenceIndexes(
    response.normalized,
    normalizedQuote,
  );
  if (normalizedMatches.length === 0) {
    throw new Error('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  }
  if (normalizedMatches.length > 1) {
    throw new Error('MODEL_EVIDENCE_AMBIGUOUS_IN_RESPONSE');
  }
  const normalizedStart = normalizedMatches[0] ?? 0;
  const normalizedEnd = normalizedStart + normalizedQuote.length;
  const originalStart = response.originalStarts[normalizedStart];
  const originalEnd = response.originalEnds[normalizedEnd - 1];
  if (originalStart === undefined || originalEnd === undefined) {
    throw new Error('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  }
  return {
    matchType:
      input.responseText.slice(originalStart, originalEnd) === input.quote
        ? 'EXACT'
        : 'TYPOGRAPHIC_EQUIVALENT',
    resolvedQuote: input.responseText.slice(originalStart, originalEnd),
  };
}

export function resolveBenchmarkModelEvidence(input: {
  output: BenchmarkCorrectionOutput;
  responseText: string;
}): {
  evidenceMatches: EvidenceMatch[];
  output: BenchmarkCorrectionOutput;
} {
  const evidenceMatches: EvidenceMatch[] = [];
  const criteria = input.output.criteria.map((criterion) => ({
    ...criterion,
    evidenceQuotes: criterion.evidenceQuotes.map((requestedQuote) => {
      const resolved = resolveBenchmarkEvidenceQuote({
        quote: requestedQuote,
        responseText: input.responseText,
      });
      evidenceMatches.push({
        criterionKey: criterion.criterionKey,
        matchType: resolved.matchType,
        requestedQuote,
        resolvedQuote: resolved.resolvedQuote,
      });
      return resolved.resolvedQuote;
    }),
  }));
  return {
    evidenceMatches,
    output: { ...input.output, criteria },
  };
}

/**
 * Bounded delivery tolerance (gate policy v3): when a quote fails only because
 * of its first-letter case, retry the resolver with the swapped-case variant.
 * The resolver's unique-match rule still applies to the variant, so an
 * ambiguous or absent quote remains rejected. Used only by the
 * PARTIAL_CRITERION delivery policy — never by strict v1/v2 identities.
 */
export function resolveBenchmarkEvidenceQuoteWithCaseTolerance(input: {
  quote: string;
  responseText: string;
}): ResolvedTextEvidence {
  try {
    return resolveBenchmarkEvidenceQuote(input);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== 'MODEL_EVIDENCE_NOT_IN_RESPONSE' ||
      input.quote.length === 0
    ) {
      throw error;
    }
    const first = input.quote.charAt(0);
    if (!/[a-zA-ZÀ-ÿ]/.test(first)) {
      throw error;
    }
    const swapped =
      first === first.toLowerCase()
        ? first.toUpperCase() + input.quote.slice(1)
        : first.toLowerCase() + input.quote.slice(1);
    try {
      const resolved = resolveBenchmarkEvidenceQuote({
        quote: swapped,
        responseText: input.responseText,
      });
      return {
        matchType:
          resolved.matchType === 'EXACT'
            ? 'TYPOGRAPHIC_EQUIVALENT'
            : resolved.matchType,
        resolvedQuote: resolved.resolvedQuote,
      };
    } catch {
      throw error;
    }
  }
}

/**
 * Gate policy v3 salvage: recover the criteria whose evidence verifies from a
 * model output that failed whole-output validation. Structural envelope
 * errors, unknown levels, evidence-coherence violations and security leaks
 * mark individual criteria as UNSURE instead of discarding the correction.
 * Security is never relaxed: an injection-case criterion is delivered only if
 * its quotes and feedback contain no forbidden fragment, no canary and no
 * quote resolving in the attack segment.
 */
