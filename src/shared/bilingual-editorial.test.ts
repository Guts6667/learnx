import {
  bilingualGlossarySchema,
  bilingualQaIsComplete,
  translationManifestSchema,
} from './bilingual-editorial';

const completeQa = {
  bibliographicTitles: true,
  culturalAndLegalContext: true,
  distractors: true,
  instructions: true,
  languageLevel: true,
  links: true,
  resources: true,
  rubrics: true,
  structure: true,
  terminology: true,
};

describe('bilingual editorial contracts', () => {
  it('validates the versioned French-English glossary', () => {
    const glossary = bilingualGlossarySchema.parse({
      schemaVersion: 1,
      sourceLocale: 'fr',
      targetLocale: 'en',
      terms: [
        {
          context: 'Structure pédagogique LearnX.',
          definition: 'Unité de contexte du parcours.',
          doNotUse: ['course'],
          key: 'lecon',
          source: 'leçon',
          target: 'lesson',
        },
      ],
      version: '1.0.0',
    });
    expect(glossary.version).toBe('1.0.0');
    expect(glossary.terms.length).toBeGreaterThan(0);
  });

  it('rejects structural drift and incomplete QA', () => {
    const manifest = {
      glossaryVersion: '1.0.0',
      qa: completeQa,
      schemaVersion: 1,
      source: {
        checksum: 'a'.repeat(64),
        locale: 'fr',
        programSlug: 'programme-fr',
        programVersion: 1,
        structureKeys: ['stage:a', 'lesson:a'],
      },
      target: {
        glossaryTermKeys: ['programme'],
        locale: 'en',
        programSlug: 'program-en',
        structureKeys: ['stage:a', 'lesson:b'],
      },
    };
    expect(translationManifestSchema.safeParse(manifest).success).toBe(false);
    expect(bilingualQaIsComplete({ ...completeQa, links: false })).toBe(false);
    expect(bilingualQaIsComplete(completeQa)).toBe(true);
  });
});
