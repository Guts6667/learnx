import { readdir, readFile } from 'node:fs/promises';

type SequenceItem = {
  key: string;
  kind:
    | 'CONTENT'
    | 'RESOURCE'
    | 'TASK'
    | 'CONCEPT_ASSESSMENT'
    | 'EXERCISE'
    | 'QUIZ';
};

type Lesson = {
  slug: string;
  contentBlocks: Array<{ key: string; content: { sourceKeys: string[] } }>;
  resources: Array<{ key: string; url: string }>;
  concepts: Array<{ slug: string; assessment: { key: string } }>;
  tasks: Array<{ key: string; type: string }>;
  quizzes?: Array<{ key: string }>;
  sequence: SequenceItem[];
};

type SequenceCycle = {
  conceptSlug: string;
  contentKeys: string[];
  resourceKeys: string[];
  activity: SequenceItem;
  assessmentKey: string;
  rationale: string;
};

type PedagogySpec = {
  specId: string;
  programSlug: string;
  stageSlug: string;
  moduleSlug: string;
  lesson: Lesson;
  editorial: {
    sequenceRationale: { strategy: string; cycles: SequenceCycle[] };
    review: { readyForPublication: boolean };
  };
};

type Seed = {
  program: {
    slug: string;
    stages: Array<{
      slug: string;
      modules: Array<{ slug: string; lessons: Lesson[] }>;
    }>;
  };
};

const specsDirectory = 'content/fondamentaux-psychologie/specs';
const passiveTaskTypes = new Set([
  'reading',
  'watching',
  'listening',
  'checklist',
]);

describe('psychology editorial lesson sequences', () => {
  it('keeps all 70 specifications aligned with the importable seed', async () => {
    const seed = JSON.parse(
      await readFile('seed/sample-program.json', 'utf8'),
    ) as Seed;
    const fileNames = (await readdir(specsDirectory))
      .filter((name) => /^PEDAGOGY_SPEC_\d{3}\.json$/.test(name))
      .sort();
    const specs = await Promise.all(
      fileNames.map(
        async (name) =>
          JSON.parse(
            await readFile(`${specsDirectory}/${name}`, 'utf8'),
          ) as PedagogySpec,
      ),
    );
    const lessons = seed.program.stages.flatMap((stage) =>
      stage.modules.flatMap((module) =>
        module.lessons.map((lesson) => ({
          lesson,
          moduleSlug: module.slug,
          stageSlug: stage.slug,
        })),
      ),
    );

    expect(fileNames).toEqual(
      Array.from(
        { length: 70 },
        (_, index) =>
          `PEDAGOGY_SPEC_${String(index + 1).padStart(3, '0')}.json`,
      ),
    );
    expect(specs).toHaveLength(lessons.length);

    specs.forEach((spec, index) => {
      const expected = lessons[index];
      const lesson = spec.lesson;
      const resourceKeys = new Set(lesson.resources.map(({ key }) => key));
      const expectedTargets: SequenceItem[] = [
        ...lesson.contentBlocks.map(({ key }) => ({
          kind: 'CONTENT' as const,
          key,
        })),
        ...lesson.resources.map(({ key }) => ({
          kind: 'RESOURCE' as const,
          key,
        })),
        ...lesson.tasks.map(({ key, type }) => ({
          kind: passiveTaskTypes.has(type)
            ? ('TASK' as const)
            : ('EXERCISE' as const),
          key,
        })),
        ...lesson.concepts.map(({ assessment }) => ({
          kind: 'CONCEPT_ASSESSMENT' as const,
          key: assessment.key,
        })),
        ...(lesson.quizzes ?? []).map(({ key }) => ({
          kind: 'QUIZ' as const,
          key,
        })),
      ];
      const reconstructed = spec.editorial.sequenceRationale.cycles.flatMap(
        (cycle) => [
          ...cycle.contentKeys.map((key) => ({
            kind: 'CONTENT' as const,
            key,
          })),
          ...cycle.resourceKeys.map((key) => ({
            kind: 'RESOURCE' as const,
            key,
          })),
          cycle.activity,
          { kind: 'CONCEPT_ASSESSMENT' as const, key: cycle.assessmentKey },
        ],
      );

      expect(spec.specId).toBe(
        `PEDAGOGY_SPEC_${String(index + 1).padStart(3, '0')}`,
      );
      expect(spec.programSlug).toBe(seed.program.slug);
      expect(spec.stageSlug).toBe(expected.stageSlug);
      expect(spec.moduleSlug).toBe(expected.moduleSlug);
      expect(lesson.slug).toBe(expected.lesson.slug);
      expect(lesson.sequence).toEqual(expected.lesson.sequence);
      expect(reconstructed).toEqual(lesson.sequence);
      expect(
        new Set(lesson.sequence.map(({ key, kind }) => `${kind}:${key}`)).size,
      ).toBe(lesson.sequence.length);
      expect([...lesson.sequence].sort(compareSequenceItems)).toEqual(
        [...expectedTargets].sort(compareSequenceItems),
      );
      expect(
        spec.editorial.sequenceRationale.cycles.map(
          ({ conceptSlug }) => conceptSlug,
        ),
      ).toEqual(lesson.concepts.map(({ slug }) => slug));
      expect(
        spec.editorial.sequenceRationale.cycles.every(
          ({ rationale }) => rationale.trim().length > 0,
        ),
      ).toBe(true);
      expect(
        lesson.contentBlocks.every(({ content }) =>
          content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
      expect(lesson.resources.every(({ url }) => url.length > 0)).toBe(true);
    });

    expect(specs[0].editorial.review.readyForPublication).toBe(false);
    expect(specs.flatMap(({ lesson }) => lesson.sequence)).toHaveLength(1_223);
    expect(
      specs
        .flatMap(({ lesson }) => lesson.sequence)
        .filter(({ kind }) => kind === 'RESOURCE'),
    ).toHaveLength(400);
  });
});

function compareSequenceItems(left: SequenceItem, right: SequenceItem) {
  return `${left.kind}:${left.key}`.localeCompare(`${right.kind}:${right.key}`);
}
