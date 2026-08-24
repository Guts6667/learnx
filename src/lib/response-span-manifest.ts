import { createHash } from 'node:crypto';

import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const spanIdSchema = z.string().regex(/^s[0-9]{4,}-[a-f0-9]{16}$/u);

export const MAX_RESPONSE_CHARACTERS = 20_000;
export const MAX_RESPONSE_SPAN_CHARACTERS = 800;
export const MAX_RESPONSE_SPANS = 256;
export const RESPONSE_SPAN_SEGMENTATION_VERSION = '2.0.0';

export const responseSpanSchema = z
  .object({
    end: z.number().int().positive(),
    sha256: sha256Schema,
    spanId: spanIdSchema,
    start: z.number().int().nonnegative(),
    text: z.string().min(1).max(MAX_RESPONSE_SPAN_CHARACTERS),
  })
  .strict()
  .refine(({ end, start }) => end > start, {
    message: 'Response span end must be greater than start.',
    path: ['end'],
  });

export const responseSpanManifestSchema = z
  .object({
    manifestSha256: sha256Schema,
    responseSha256: sha256Schema,
    schemaVersion: z.literal(1),
    segmentationVersion: z.literal(RESPONSE_SPAN_SEGMENTATION_VERSION),
    spans: z.array(responseSpanSchema).max(MAX_RESPONSE_SPANS),
  })
  .strict();

export type ResponseSpan = z.infer<typeof responseSpanSchema>;
export type ResponseSpanManifest = z.infer<typeof responseSpanManifestSchema>;

type SpanRange = { end: number; start: number };
type ManifestCore = Omit<ResponseSpanManifest, 'manifestSha256'>;

const boundaryCharacters = new Set(['.', '!', '?', '…', ';']);
const trailingClosingCharacters = new Set([
  '"',
  "'",
  ')',
  ']',
  '}',
  '»',
  '’',
  '”',
]);
const whitespacePattern = /\s/u;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)]),
    );
  }
  return input;
}

function manifestSha256(core: ManifestCore): string {
  return sha256(JSON.stringify(canonicalize(core)));
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && whitespacePattern.test(character);
}

function trimmedRange(
  responseText: string,
  rawStart: number,
  rawEnd: number,
): SpanRange | null {
  let start = rawStart;
  let end = rawEnd;
  while (start < end && isWhitespace(responseText[start])) start += 1;
  while (end > start && isWhitespace(responseText[end - 1])) end -= 1;
  return end > start ? { end, start } : null;
}

function pushTrimmedRange(
  ranges: SpanRange[],
  responseText: string,
  start: number,
  end: number,
): void {
  const range = trimmedRange(responseText, start, end);
  if (range) ranges.push(range);
}

function utf16SafeHardEnd(
  responseText: string,
  start: number,
  proposedEnd: number,
): number {
  const previousCodeUnit = responseText.charCodeAt(proposedEnd - 1);
  const nextCodeUnit = responseText.charCodeAt(proposedEnd);
  const splitsSurrogatePair =
    previousCodeUnit >= 0xd800 &&
    previousCodeUnit <= 0xdbff &&
    nextCodeUnit >= 0xdc00 &&
    nextCodeUnit <= 0xdfff;
  return splitsSurrogatePair && proposedEnd - 1 > start
    ? proposedEnd - 1
    : proposedEnd;
}

function preferredWhitespaceBoundary(
  responseText: string,
  start: number,
  hardEnd: number,
): number {
  const minimumPreferredEnd =
    start + Math.floor(MAX_RESPONSE_SPAN_CHARACTERS / 2);
  for (let index = hardEnd; index >= minimumPreferredEnd; index -= 1) {
    if (isWhitespace(responseText[index])) return index;
  }
  return hardEnd;
}

function splitLongRange(responseText: string, range: SpanRange): SpanRange[] {
  const ranges: SpanRange[] = [];
  let start = range.start;
  while (range.end - start > MAX_RESPONSE_SPAN_CHARACTERS) {
    const proposedEnd = start + MAX_RESPONSE_SPAN_CHARACTERS;
    const hardEnd = utf16SafeHardEnd(responseText, start, proposedEnd);
    const end = preferredWhitespaceBoundary(responseText, start, hardEnd);
    pushTrimmedRange(ranges, responseText, start, end);
    start = end;
    while (start < range.end && isWhitespace(responseText[start])) start += 1;
  }
  pushTrimmedRange(ranges, responseText, start, range.end);
  return ranges;
}

function terminalBoundaryEnd(
  responseText: string,
  index: number,
): number | null {
  const character = responseText[index];
  if (!character || !boundaryCharacters.has(character)) return null;

  let end = index + 1;
  while (end < responseText.length) {
    const next = responseText[end];
    if (
      next !== undefined &&
      (boundaryCharacters.has(next) || trailingClosingCharacters.has(next))
    ) {
      end += 1;
      continue;
    }
    break;
  }
  return end === responseText.length || isWhitespace(responseText[end])
    ? end
    : null;
}

function responseSpanRanges(responseText: string): SpanRange[] {
  const sentenceRanges: SpanRange[] = [];
  let segmentStart = 0;

  for (let index = 0; index < responseText.length; index += 1) {
    const character = responseText[index];
    if (character === '\r' || character === '\n') {
      pushTrimmedRange(sentenceRanges, responseText, segmentStart, index);
      if (character === '\r' && responseText[index + 1] === '\n') index += 1;
      segmentStart = index + 1;
      continue;
    }

    const boundaryEnd = terminalBoundaryEnd(responseText, index);
    if (boundaryEnd === null) continue;
    pushTrimmedRange(sentenceRanges, responseText, segmentStart, boundaryEnd);
    segmentStart = boundaryEnd;
    index = boundaryEnd - 1;
  }

  pushTrimmedRange(
    sentenceRanges,
    responseText,
    segmentStart,
    responseText.length,
  );
  const boundedRanges = sentenceRanges.flatMap((range) =>
    splitLongRange(responseText, range),
  );
  if (boundedRanges.length > MAX_RESPONSE_SPANS) {
    throw new Error('RESPONSE_SPAN_COUNT_EXCEEDED');
  }
  return boundedRanges;
}

function stableSpanId(input: {
  end: number;
  index: number;
  responseSha256: string;
  spanSha256: string;
  start: number;
}): string {
  const ordinal = String(input.index + 1).padStart(4, '0');
  const digest = sha256(
    [
      RESPONSE_SPAN_SEGMENTATION_VERSION,
      input.responseSha256,
      input.start,
      input.end,
      input.spanSha256,
    ].join(':'),
  ).slice(0, 16);
  return `s${ordinal}-${digest}`;
}

export function createResponseSpanManifest(
  responseText: string,
): ResponseSpanManifest {
  if (responseText.length > MAX_RESPONSE_CHARACTERS) {
    throw new Error('RESPONSE_TEXT_CHARACTER_LIMIT_EXCEEDED');
  }
  const responseSha256 = sha256(responseText);
  const spans = responseSpanRanges(responseText).map(
    ({ end, start }, index) => {
      const text = responseText.slice(start, end);
      const spanSha256 = sha256(text);
      return {
        end,
        sha256: spanSha256,
        spanId: stableSpanId({
          end,
          index,
          responseSha256,
          spanSha256,
          start,
        }),
        start,
        text,
      };
    },
  );
  const core: ManifestCore = {
    responseSha256,
    schemaVersion: 1,
    segmentationVersion: RESPONSE_SPAN_SEGMENTATION_VERSION,
    spans,
  };
  return responseSpanManifestSchema.parse({
    ...core,
    manifestSha256: manifestSha256(core),
  });
}

function assertSpanIntegrity(
  responseText: string,
  spans: ResponseSpan[],
): void {
  const spanIds = spans.map(({ spanId }) => spanId);
  if (new Set(spanIds).size !== spanIds.length) {
    throw new Error('RESPONSE_SPAN_ID_DUPLICATE');
  }
  spans.forEach((span, index) => {
    const previous = spans[index - 1];
    if (previous && previous.end > span.start) {
      throw new Error('RESPONSE_SPAN_ORDER_INVALID');
    }
    const exactText = responseText.slice(span.start, span.end);
    if (exactText !== span.text || sha256(exactText) !== span.sha256) {
      throw new Error('RESPONSE_SPAN_OFFSET_HASH_MISMATCH');
    }
  });
}

export function validateResponseSpanManifest(input: {
  manifest: unknown;
  responseText: string;
}): ResponseSpanManifest {
  const manifest = responseSpanManifestSchema.parse(input.manifest);
  if (manifest.responseSha256 !== sha256(input.responseText)) {
    throw new Error('RESPONSE_SPAN_RESPONSE_HASH_MISMATCH');
  }
  const { manifestSha256: receivedManifestSha256, ...core } = manifest;
  if (receivedManifestSha256 !== manifestSha256(core)) {
    throw new Error('RESPONSE_SPAN_MANIFEST_HASH_MISMATCH');
  }
  assertSpanIntegrity(input.responseText, manifest.spans);
  const expected = createResponseSpanManifest(input.responseText);
  if (JSON.stringify(manifest) !== JSON.stringify(expected)) {
    throw new Error('RESPONSE_SPAN_SEGMENTATION_MISMATCH');
  }
  return manifest;
}
