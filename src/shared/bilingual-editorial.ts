import { z } from 'zod';

export const bilingualQaChecksSchema = z
  .object({
    bibliographicTitles: z.boolean(),
    culturalAndLegalContext: z.boolean(),
    distractors: z.boolean(),
    instructions: z.boolean(),
    languageLevel: z.boolean(),
    links: z.boolean(),
    resources: z.boolean(),
    rubrics: z.boolean(),
    structure: z.boolean(),
    terminology: z.boolean(),
  })
  .strict();

export type BilingualQaChecks = z.infer<typeof bilingualQaChecksSchema>;

export function bilingualQaIsComplete(value: unknown): value is BilingualQaChecks {
  const parsed = bilingualQaChecksSchema.safeParse(value);
  return parsed.success && Object.values(parsed.data).every(Boolean);
}

const glossaryTermSchema = z
  .object({
    context: z.string().trim().min(1),
    definition: z.string().trim().min(1),
    doNotUse: z.array(z.string().trim().min(1)).default([]),
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    source: z.string().trim().min(1),
    target: z.string().trim().min(1),
  })
  .strict();

export const bilingualGlossarySchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceLocale: z.literal('fr'),
    targetLocale: z.literal('en'),
    terms: z.array(glossaryTermSchema).min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = new Set<string>();
    for (const [index, term] of value.terms.entries()) {
      if (keys.has(term.key)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate glossary key: ${term.key}`,
          path: ['terms', index, 'key'],
        });
      }
      keys.add(term.key);
    }
  });

export const translationManifestSchema = z
  .object({
    glossaryVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    qa: bilingualQaChecksSchema,
    schemaVersion: z.literal(1),
    source: z
      .object({
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        locale: z.literal('fr'),
        programSlug: z.string().trim().min(1),
        programVersion: z.number().int().positive(),
        structureKeys: z.array(z.string().trim().min(1)).min(1),
      })
      .strict(),
    target: z
      .object({
        glossaryTermKeys: z.array(z.string().trim().min(1)),
        locale: z.literal('en'),
        programSlug: z.string().trim().min(1),
        structureKeys: z.array(z.string().trim().min(1)).min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      JSON.stringify(value.source.structureKeys) !==
      JSON.stringify(value.target.structureKeys)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Source and target canonical structures differ.',
        path: ['target', 'structureKeys'],
      });
    }
  });
