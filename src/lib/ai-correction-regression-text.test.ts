import { describe, expect, it } from 'vitest';

import {
  countOccurrences,
  removeSpan,
  segmentParagraphs,
  segmentSentences,
} from './ai-correction-regression-text.js';

/** Indexed access that fails the test loudly instead of asserting non-null. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Aucun élément à l'index ${index}.`);
  }
  return item;
}

describe('regression suite text segmentation', () => {
  it('segments French sentences with offsets into the original string', () => {
    const text =
      'Je recommande le pilote. Le délai est passé de 18 à 13 heures.';
    const segments = segmentSentences({ locale: 'fr-FR', text });

    expect(segments).toHaveLength(2);
    expect(segments[0]?.text.trim()).toBe('Je recommande le pilote.');
    expect(text.slice(at(segments, 1).start, at(segments, 1).end)).toBe(
      at(segments, 1).text,
    );
    expect(segments[1]?.text.trim()).toBe(
      'Le délai est passé de 18 à 13 heures.',
    );
  });

  it('does not index a segment that carries no letter or digit', () => {
    // A stray separator must not become "sentence 1", or every authored
    // sentenceIndex after it would silently point one sentence too far.
    const segments = segmentSentences({
      locale: 'fr-FR',
      text: 'Premier point. ... Deuxième point.',
    });

    expect(segments.map((segment) => segment.text.trim())).toEqual([
      'Premier point. ...',
      'Deuxième point.',
    ]);
  });

  it('keeps abbreviations inside one sentence', () => {
    const segments = segmentSentences({
      locale: 'fr-FR',
      text: 'Le coût est de 2 700 euros env. pour la réparation complète.',
    });

    expect(segments).toHaveLength(1);
  });

  it('removes a span and repairs the spacing it leaves behind', () => {
    const text = 'Un. Deux. Trois.';
    const segments = segmentSentences({ locale: 'fr-FR', text });

    expect(
      removeSpan({
        end: at(segments, 1).end,
        start: at(segments, 1).start,
        text,
      }),
    ).toBe('Un. Trois.');
  });

  it('trims cleanly when the removed span is first or last', () => {
    const text = 'Un. Deux.';
    const segments = segmentSentences({ locale: 'fr-FR', text });

    expect(
      removeSpan({
        end: at(segments, 0).end,
        start: at(segments, 0).start,
        text,
      }),
    ).toBe('Deux.');
    expect(
      removeSpan({
        end: at(segments, 1).end,
        start: at(segments, 1).start,
        text,
      }),
    ).toBe('Un.');
  });

  it('splits paragraphs on blank lines and keeps their separators', () => {
    const { paragraphs, separators } = segmentParagraphs(
      'Premier paragraphe.\n\nDeuxième paragraphe.\n\n\nTroisième.',
    );

    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'Premier paragraphe.',
      'Deuxième paragraphe.',
      'Troisième.',
    ]);
    expect(separators).toEqual(['\n\n', '\n\n\n']);
  });

  it('treats a single-newline text as one paragraph', () => {
    const { paragraphs } = segmentParagraphs('Une ligne.\nUne autre ligne.');

    expect(paragraphs).toHaveLength(1);
  });

  it('counts non-overlapping occurrences', () => {
    expect(countOccurrences({ haystack: 'aaaa', needle: 'aa' })).toBe(2);
    expect(
      countOccurrences({ haystack: 'de 18 à 13 heures', needle: '18' }),
    ).toBe(1);
    expect(countOccurrences({ haystack: 'rien', needle: '' })).toBe(0);
  });
});
