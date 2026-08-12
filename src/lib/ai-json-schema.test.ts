import { describe, expect, it } from 'vitest';

import { sanitizeStructuredOutputJsonSchema } from './ai-json-schema.js';

describe('sanitizeStructuredOutputJsonSchema', () => {
  it('removes unsupported numeric constraints without weakening the local schema', () => {
    const schema = {
      properties: {
        confidence: {
          maximum: 1,
          minimum: 0,
          multipleOf: 0.01,
          type: 'number',
        },
        scores: {
          items: {
            exclusiveMaximum: 101,
            exclusiveMinimum: -1,
            type: 'number',
          },
          minItems: 1,
          type: 'array',
        },
      },
      required: ['confidence', 'scores'],
      type: 'object',
    };

    expect(sanitizeStructuredOutputJsonSchema(schema)).toEqual({
      properties: {
        confidence: { type: 'number' },
        scores: {
          items: { type: 'number' },
          minItems: 1,
          type: 'array',
        },
      },
      required: ['confidence', 'scores'],
      type: 'object',
    });
    expect(schema.properties.confidence).toHaveProperty('minimum', 0);
  });
});
