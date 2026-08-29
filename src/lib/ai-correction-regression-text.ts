/**
 * Deterministic text segmentation for the V4.5-120 regression suite.
 *
 * Both the pool validator and the mutant generator must agree, to the offset,
 * on what "sentence 2" of a response is: the validator accepts a
 * `sentenceIndex` hint only if the generator will later be able to act on it.
 * Sharing one segmentation implementation is what makes that guarantee hold —
 * two independent readings of `Intl.Segmenter` would drift silently.
 *
 * Segmentation is by `Intl.Segmenter` with the corpus locale, and UTF-16
 * offsets are preserved so a deletion can be expressed as a slice of the
 * original string rather than a re-join of parsed pieces.
 */

export type TextSegment = {
  /** UTF-16 offset of the first code unit, into the original string. */
  start: number;
  /** UTF-16 offset one past the last code unit, into the original string. */
  end: number;
  /** The exact slice `[start, end)` of the original string. */
  text: string;
};

/**
 * Sentences of `text`, in order, with their offsets into `text`.
 *
 * Segments that hold no letter or digit (stray punctuation or whitespace left
 * between sentences) are not sentences for our purposes: a hint pointing at one
 * would delete nothing observable, so they are excluded from the indexable set
 * while their characters stay attached to the preceding sentence's span.
 */
export function segmentSentences(input: {
  locale: string;
  text: string;
}): TextSegment[] {
  const segmenter = new Intl.Segmenter(input.locale, {
    granularity: 'sentence',
  });
  const segments: TextSegment[] = [];
  for (const segment of segmenter.segment(input.text)) {
    const start = segment.index;
    const end = start + segment.segment.length;
    if (!hasContent(segment.segment)) {
      const previous = segments.at(-1);
      if (previous) {
        previous.end = end;
        previous.text = input.text.slice(previous.start, end);
      }
      continue;
    }
    segments.push({ end, start, text: segment.segment });
  }
  return segments;
}

/**
 * Paragraphs of `text`, in order, with their offsets.
 *
 * A paragraph break is one or more blank lines. The separators between
 * paragraphs are returned alongside them so a shuffle can rebuild the text with
 * the original spacing rather than a normalised guess.
 */
export function segmentParagraphs(text: string): {
  paragraphs: TextSegment[];
  separators: string[];
} {
  const paragraphs: TextSegment[] = [];
  const separators: string[] = [];
  const pattern = /\n[ \t]*(?:\r?\n[ \t]*)+/g;
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    pushParagraph({ end: match.index, paragraphs, start: cursor, text });
    separators.push(match[0]);
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  pushParagraph({ end: text.length, paragraphs, start: cursor, text });
  return { paragraphs, separators };
}

function pushParagraph(input: {
  end: number;
  paragraphs: TextSegment[];
  start: number;
  text: string;
}): void {
  const slice = input.text.slice(input.start, input.end);
  if (!hasContent(slice)) return;
  input.paragraphs.push({
    end: input.end,
    start: input.start,
    text: slice,
  });
}

/** Whether a slice carries anything a criterion could be graded on. */
function hasContent(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

/**
 * Removes the segment at `[start, end)` and repairs the spacing it leaves
 * behind, so a deletion never produces a double space or a leading space.
 */
export function removeSpan(input: {
  end: number;
  start: number;
  text: string;
}): string {
  const before = input.text.slice(0, input.start);
  const after = input.text.slice(input.end);
  if (before.length === 0) return after.trimStart();
  if (after.trim().length === 0) return before.trimEnd();
  return `${before.trimEnd()} ${after.trimStart()}`;
}

/** Occurrences of `needle` in `haystack`, counted without overlap. */
export function countOccurrences(input: {
  haystack: string;
  needle: string;
}): number {
  if (input.needle.length === 0) return 0;
  let count = 0;
  let index = input.haystack.indexOf(input.needle);
  while (index !== -1) {
    count += 1;
    index = input.haystack.indexOf(input.needle, index + input.needle.length);
  }
  return count;
}
