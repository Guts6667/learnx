import {
  readSampleProgram,
  seedSampleProgram,
  type SeedProgramRepository,
} from './seed';

function createRepository() {
  const assessments = new Map<string, number>();
  const concepts = new Map<string, string>();
  const programs = new Map<string, string>();
  const stages = new Map<string, string>();
  const modules = new Map<string, string>();
  const lessons = new Map<string, string>();

  const repository: SeedProgramRepository = {
    async replaceConceptAssessments(conceptId, inputs) {
      assessments.set(conceptId, inputs.length);
    },
    async upsertConcept(input) {
      const key = `${input.lessonId}:${input.slug}`;
      const id = concepts.get(key) ?? `concept-${concepts.size + 1}`;

      concepts.set(key, id);
      return { id };
    },
    async upsertLesson(input) {
      const key = `${input.moduleId}:${input.slug}`;
      const id = lessons.get(key) ?? `lesson-${lessons.size + 1}`;

      lessons.set(key, id);
      return { id };
    },
    async upsertModule(input) {
      const key = `${input.stageId}:${input.slug}`;
      const id = modules.get(key) ?? `module-${modules.size + 1}`;

      modules.set(key, id);
      return { id };
    },
    async upsertProgram(input) {
      const key = `${input.ownerId}:${input.slug}`;
      const id = programs.get(key) ?? `program-${programs.size + 1}`;

      programs.set(key, id);
      return { id };
    },
    async upsertStage(input) {
      const key = `${input.programId}:${input.slug}`;
      const id = stages.get(key) ?? `stage-${stages.size + 1}`;

      stages.set(key, id);
      return { id };
    },
  };

  return {
    assessments,
    concepts,
    lessons,
    modules,
    programs,
    repository,
    stages,
  };
}

describe('sample program seed', () => {
  it('reads the curriculum hierarchy from the example JSON', async () => {
    const sampleProgram = await readSampleProgram();

    expect(sampleProgram.slug).toBe('fondamentaux-psychologie');
    expect(sampleProgram.stages).toHaveLength(5);
    expect(sampleProgram.stages.flatMap((stage) => stage.modules)).toHaveLength(
      6,
    );
  });

  it('upserts the example program without duplicating its hierarchy', async () => {
    const sampleProgram = await readSampleProgram();
    const {
      assessments,
      concepts,
      lessons,
      modules,
      programs,
      repository,
      stages,
    } = createRepository();

    await seedSampleProgram(repository, 'user-1', sampleProgram);
    await seedSampleProgram(repository, 'user-1', sampleProgram);

    expect(programs).toHaveLength(1);
    expect(stages).toHaveLength(5);
    expect(modules).toHaveLength(6);
    expect(lessons).toHaveLength(21);
    expect(concepts).toHaveLength(21);
    expect(assessments).toHaveLength(21);
    expect([...assessments.values()].every((count) => count === 1)).toBe(true);
  });

  it('refuse une notion obligatoire sans activité de validation', async () => {
    const source = await readSampleProgram();
    const invalidProgram = structuredClone(source);

    invalidProgram.stages[0].modules[0].lessons[0].concepts[0].assessment =
      undefined;

    await expect(
      seedSampleProgram(
        createRepository().repository,
        'user-1',
        invalidProgram,
      ),
    ).rejects.toThrow();
  });
});
