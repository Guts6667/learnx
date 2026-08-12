const unsupportedNumericKeywords = new Set([
  'exclusiveMaximum',
  'exclusiveMinimum',
  'maximum',
  'minimum',
  'multipleOf',
]);

export function sanitizeStructuredOutputJsonSchema(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((value) => sanitizeStructuredOutputJsonSchema(value));
  }
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !unsupportedNumericKeywords.has(key))
      .map(([key, value]) => [
        key,
        sanitizeStructuredOutputJsonSchema(value),
      ]),
  );
}
