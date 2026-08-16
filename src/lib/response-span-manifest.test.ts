import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createResponseSpanManifest,
  MAX_RESPONSE_CHARACTERS,
  MAX_RESPONSE_SPAN_CHARACTERS,
  MAX_RESPONSE_SPANS,
  RESPONSE_SPAN_SEGMENTATION_VERSION,
  validateResponseSpanManifest,
} from './response-span-manifest.ts';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

describe('response span manifest', () => {
  it('creates stable exact spans without normalizing the learner response', () => {
    const responseText =
      '  Première preuve 🧭.\r\nDeuxième preuve; troisième preuve…  ';
    const first = createResponseSpanManifest(responseText);
    const second = createResponseSpanManifest(responseText);

    expect(first).toEqual(second);
    expect(first.segmentationVersion).toBe(RESPONSE_SPAN_SEGMENTATION_VERSION);
    expect(first.spans.map(({ text }) => text)).toEqual([
      'Première preuve 🧭.',
      'Deuxième preuve;',
      'troisième preuve…',
    ]);
    first.spans.forEach((span) => {
      expect(responseText.slice(span.start, span.end)).toBe(span.text);
      expect(span.sha256).toBe(sha256(span.text));
      expect(span.spanId).toMatch(/^s[0-9]{4,}-[a-f0-9]{16}$/u);
    });
    expect(
      validateResponseSpanManifest({ manifest: first, responseText }),
    ).toEqual(first);
  });

  it.each([
    ['apostrophe typographique', 'L’apprenant justifie son choix.'],
    ['accent NFD', 'e\u0301valuation exacte.'],
    ['NBSP interne', 'preuve\u00a0exacte.'],
    ['emoji', 'preuve 🧭 exacte.'],
  ])('preserves %s byte-for-byte', (_label, responseText) => {
    const manifest = createResponseSpanManifest(responseText);
    const span = required(manifest.spans[0]);

    expect(span.text).toBe(responseText);
    expect(responseText.slice(span.start, span.end)).toBe(responseText);
  });

  it('splits a long unpunctuated segment deterministically at bounded offsets', () => {
    const responseText = `début ${'preuve '.repeat(240)}fin`;
    const first = createResponseSpanManifest(responseText);
    const second = createResponseSpanManifest(responseText);

    expect(first).toEqual(second);
    expect(first.spans.length).toBeGreaterThan(1);
    expect(
      first.spans.every(
        ({ text }) => text.length <= MAX_RESPONSE_SPAN_CHARACTERS,
      ),
    ).toBe(true);
    first.spans.forEach((span) => {
      expect(responseText.slice(span.start, span.end)).toBe(span.text);
    });
  });

  it('never splits a UTF-16 surrogate pair at the hard span boundary', () => {
    const responseText = `${'a'.repeat(MAX_RESPONSE_SPAN_CHARACTERS - 1)}🧭${'b'.repeat(20)}`;
    const manifest = createResponseSpanManifest(responseText);

    expect(manifest.spans.map(({ text }) => text).join('')).toBe(responseText);
    expect(manifest.spans.every(({ text }) => !text.includes('\uFFFD'))).toBe(
      true,
    );
  });

  it('rejects a response above the explicit character limit', () => {
    expect(() =>
      createResponseSpanManifest('a'.repeat(MAX_RESPONSE_CHARACTERS + 1)),
    ).toThrow('RESPONSE_TEXT_CHARACTER_LIMIT_EXCEEDED');
  });

  it('rejects a response producing more than the explicit span limit', () => {
    expect(() =>
      createResponseSpanManifest('a. '.repeat(MAX_RESPONSE_SPANS + 1)),
    ).toThrow('RESPONSE_SPAN_COUNT_EXCEEDED');
  });

  it('binds span identifiers and the manifest to the exact response', () => {
    const first = createResponseSpanManifest('Une preuve exacte.');
    const edited = createResponseSpanManifest('Une preuve exacte !');

    expect(first.responseSha256).not.toBe(edited.responseSha256);
    expect(first.manifestSha256).not.toBe(edited.manifestSha256);
    expect(first.spans[0]?.spanId).not.toBe(edited.spans[0]?.spanId);
    expect(() =>
      validateResponseSpanManifest({
        manifest: first,
        responseText: 'Une preuve exacte !',
      }),
    ).toThrow('RESPONSE_SPAN_RESPONSE_HASH_MISMATCH');
  });

  it('rejects a modified manifest before using its offsets', () => {
    const responseText = 'Une preuve exacte.';
    const manifest = createResponseSpanManifest(responseText);
    const modified = structuredClone(manifest);
    required(modified.spans[0]).start = 1;

    expect(() =>
      validateResponseSpanManifest({ manifest: modified, responseText }),
    ).toThrow('RESPONSE_SPAN_MANIFEST_HASH_MISMATCH');
  });

  it('represents an empty or whitespace-only response with no spans', () => {
    expect(createResponseSpanManifest(' \r\n\t').spans).toEqual([]);
  });
});
