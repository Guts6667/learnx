import { readFile } from 'node:fs/promises';

import {
  readSampleProgram,
  readSampleSeed,
  seedSampleProgram,
  type SeedProgramRepository,
} from './seed';

function createRepository() {
  const assessments = new Map<string, string>();
  const assessmentQuestions = new Map<
    string,
    Parameters<SeedProgramRepository['replaceConceptAssessmentQuestions']>[1]
  >();
  const conceptResources = new Map<string, string[]>();
  const taskResources = new Map<string, string[]>();
  const concepts = new Map<string, string>();
  const contentBlocks = new Map<string, string>();
  const exercises = new Map<string, string>();
  const programs = new Map<string, string>();
  const stages = new Map<string, string>();
  const stageAssessments = new Map<string, string>();
  const stageAssessmentInputs = new Map<
    string,
    Parameters<SeedProgramRepository['upsertStageAssessment']>[0]
  >();
  const modules = new Map<string, string>();
  const lessons = new Map<string, string>();
  const resources = new Map<string, string>();
  const tasks = new Map<string, string>();

  const repository: SeedProgramRepository = {
    async archiveExerciseMirror(input) {
      exercises.delete(`${input.lessonId}:${input.key}`);
    },
    async archiveTaskMirror(input) {
      tasks.delete(`${input.lessonId}:${input.key}`);
    },
    async deleteConceptsNotIn(lessonId, slugs) {
      for (const key of concepts.keys()) {
        if (
          key.startsWith(`${lessonId}:`) &&
          !slugs.includes(key.split(':')[1])
        ) {
          concepts.delete(key);
        }
      }
    },
    async deleteConceptAssessmentsNotIn(conceptId, positions) {
      for (const key of assessments.keys()) {
        const [storedConceptId, position] = key.split(':');

        if (
          storedConceptId === conceptId &&
          !positions.includes(Number(position))
        ) {
          const assessmentId = assessments.get(key);
          assessments.delete(key);
          if (assessmentId) assessmentQuestions.delete(assessmentId);
        }
      }
    },
    async pruneEditorialContent(input) {
      for (const key of contentBlocks.keys()) {
        const [lessonId, position] = key.split(':');

        if (
          lessonId === input.lessonId &&
          !input.contentBlockPositions.includes(Number(position))
        ) {
          contentBlocks.delete(key);
        }
      }

      for (const key of resources.keys()) {
        const [lessonId, resourceKey] = key.split(':');

        if (
          lessonId === input.lessonId &&
          !input.resourceKeys.includes(resourceKey)
        ) {
          resources.delete(key);
        }
      }

    },
    async pruneExercises(lessonId, positions) {
      for (const key of exercises.keys()) {
        const [storedLessonId, position] = key.split(':');

        if (
          storedLessonId === lessonId &&
          !positions.includes(Number(position))
        ) {
          exercises.delete(key);
        }
      }
    },
    async pruneCanonicalActivities(input) {
      for (const key of tasks.keys()) {
        const [lessonId, activityKey] = key.split(':');
        if (lessonId === input.lessonId && !input.taskKeys.includes(activityKey)) {
          tasks.delete(key);
        }
      }
      for (const key of exercises.keys()) {
        const [lessonId, activityKey] = key.split(':');
        if (
          lessonId === input.lessonId &&
          !input.exerciseKeys.includes(activityKey)
        ) {
          exercises.delete(key);
        }
      }
    },
    async replaceConceptAssessmentQuestions(assessmentId, questions) {
      assessmentQuestions.set(assessmentId, questions);
    },
    async replaceConceptResources(conceptId, resourceIds) {
      conceptResources.set(conceptId, resourceIds);
    },
    async replaceTaskResources(taskId, resourceIds) {
      taskResources.set(taskId, resourceIds);
    },
    async syncActivityCarryovers() {},
    async upsertContentBlock(input) {
      const key = `${input.lessonId}:${input.position}`;
      const id = contentBlocks.get(key) ?? `block-${contentBlocks.size + 1}`;

      contentBlocks.set(key, id);
      return { id };
    },
    async upsertConcept(input) {
      const key = `${input.lessonId}:${input.slug}`;
      const id = concepts.get(key) ?? `concept-${concepts.size + 1}`;

      concepts.set(key, id);
      return { id };
    },
    async upsertConceptAssessment(input) {
      const key = `${input.conceptId}:${input.position}`;
      const id = assessments.get(key) ?? `assessment-${assessments.size + 1}`;

      assessments.set(key, id);
      return { id };
    },
    async upsertLesson(input) {
      const key = `${input.moduleId}:${input.slug}`;
      const id = lessons.get(key) ?? `lesson-${lessons.size + 1}`;

      lessons.set(key, id);
      return { id };
    },
    async upsertExercise(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = exercises.get(key) ?? `exercise-${exercises.size + 1}`;

      exercises.set(key, id);
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
    async upsertResource(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = resources.get(key) ?? `resource-${resources.size + 1}`;

      resources.set(key, id);
      return { id };
    },
    async upsertStage(input) {
      const key = `${input.programId}:${input.slug}`;
      const id = stages.get(key) ?? `stage-${stages.size + 1}`;

      stages.set(key, id);
      return { id };
    },
    async upsertStageAssessment(input) {
      const key = `${input.stageId}:${input.position}`;
      const id =
        stageAssessments.get(key) ??
        `stage-assessment-${stageAssessments.size + 1}`;

      stageAssessments.set(key, id);
      stageAssessmentInputs.set(key, input);
      return { id };
    },
    async upsertTask(input) {
      const key = `${input.lessonId}:${input.key}`;
      const id = tasks.get(key) ?? `task-${tasks.size + 1}`;

      tasks.set(key, id);
      return { id };
    },
  };

  return {
    assessments,
    assessmentQuestions,
    conceptResources,
    concepts,
    contentBlocks,
    exercises,
    lessons,
    modules,
    programs,
    repository,
    resources,
    stages,
    stageAssessments,
    stageAssessmentInputs,
    tasks,
    taskResources,
  };
}

describe('sample program seed', () => {
  it('reads the curriculum hierarchy from the example JSON', async () => {
    const sampleProgram = await readSampleProgram();

    expect(sampleProgram.slug).toBe('fondamentaux-psychologie');
    expect(sampleProgram.stages).toHaveLength(13);
    expect(sampleProgram.stages.flatMap((stage) => stage.modules)).toHaveLength(
      22,
    );
  });

  it('lit les trois leçons et les neuf banques de la première étape', async () => {
    const sampleSeed = await readSampleSeed();
    const lessons = sampleSeed.program.stages[0].modules[0].lessons.slice(0, 3);
    const lesson = lessons[0];

    expect(lesson.title).toBe('Définir la psychologie');
    expect(lessons.map((item) => item.title)).toEqual([
      'Définir la psychologie',
      'Les grands domaines',
      'Les métiers et l’éthique',
    ]);
    expect(lessons.every((item) => item.contentBlocks.length === 5)).toBe(true);
    expect(lessons.map((item) => item.resources.length)).toEqual([5, 3, 3]);
    expect(lessons.every((item) => item.concepts.length === 3)).toBe(true);
    expect(lessons.every((item) => item.tasks.length === 3)).toBe(true);
    expect(lesson.resources.map((resource) => resource.key)).toEqual([
      'openstax-psychology-2e-1-1',
      'apa-definition-psychology',
      'yale-psyc110-lecture-1',
      'openstax-psychology-2e-2-1',
      'openstax-psychology-2e-2-2',
    ]);
    expect(
      lesson.resources.filter((resource) => resource.isRequired),
    ).toHaveLength(2);
    expect(
      lesson.resources
        .filter((resource) =>
          resource.key.startsWith('openstax-psychology-2e-2-'),
        )
        .every((resource) => !resource.isRequired),
    ).toBe(true);
    expect(
      sampleSeed.conceptAssessmentBanks
        .filter((group) => group.stageSlug === 'decouvrir-discipline')
        .flatMap((group) => group.assessmentBanks),
    ).toHaveLength(9);
    expect(
      sampleSeed.conceptAssessmentBanks
        .filter((group) => group.stageSlug === 'decouvrir-discipline')
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);
    const sourceLinks = lessons.flatMap((item) =>
      item.contentBlocks.flatMap((block) => block.content.sourceKeys),
    );

    expect(sourceLinks).toHaveLength(24);
    for (const item of lessons) {
      const resourceKeys = new Set(
        item.resources.map((resource) => resource.key),
      );

      expect(
        item.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }
  });

  it('lit les trois leçons et les neuf banques de la deuxième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'grands-courants',
    );
    const lessons = stage?.modules[0].lessons ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'grands-courants',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'naissance-psychologie-experimentale',
      'behaviorisme-apprentissage',
      'courants-modernes',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 5)).toBe(
      true,
    );
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([3, 4, 4]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(3);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(9);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('Comparer plusieurs explications'),
      instructions: expect.stringContaining('## Cas CampusLang'),
      rubric: expect.arrayContaining([
        expect.objectContaining({
          criterion: 'Exactitude historique et conceptuelle',
        }),
      ]),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les huit leçons et les vingt-quatre banques de la troisième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'raisonner-scientifiquement',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'raisonner-scientifiquement',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'question-hypothese-operationnalisation',
      'correlation-causalite',
      'plans-recherche',
      'echantillonnage-validite',
      'ethique-recherche',
      'anatomie-article',
      'lecture-strategique',
      'hierarchie-preuves',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 5)).toBe(
      true,
    );
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([
      3, 3, 4, 4, 3, 3, 2, 3,
    ]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(
      new Set(
        lessons.flatMap((lesson) => lesson.concepts.map(({ slug }) => slug)),
      ).size,
    ).toBe(24);
    expect(assessmentGroups).toHaveLength(8);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(24);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(120);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('fiche critique'),
      instructions: expect.stringContaining('## Cas RespireCampus'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les trois leçons et les neuf banques de la quatrième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'outils-quantitatifs',
    );
    const lessons = stage?.modules[0].lessons ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'outils-quantitatifs',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'decrire-donnees',
      'distributions-incertitude',
      'tests-interpretation',
    ]);
    expect(lessons.map((lesson) => lesson.contentBlocks.length)).toEqual([
      5, 5, 6,
    ]);
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([4, 4, 5]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(3);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(9);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(45);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('petit jeu de données fictif'),
      instructions: expect.stringContaining('## Cas PauseFocus'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les quatre leçons et les douze banques de la cinquième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'comprendre-cognition',
    );
    const lessons = stage?.modules[0].lessons ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'comprendre-cognition',
    );

    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'apprentissage',
      'memoire',
      'attention-perception',
      'metacognition',
    ]);
    expect(lessons.map((lesson) => lesson.contentBlocks.length)).toEqual([
      5, 6, 6, 6,
    ]);
    expect(lessons.map((lesson) => lesson.resources.length)).toEqual([
      6, 7, 7, 4,
    ]);
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(4);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(12);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(60);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('dispositif fictif de formation'),
      instructions: expect.stringContaining('## Cas SignalClair'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la sixième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'bases-biologiques',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'bases-biologiques',
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'organisation-systeme-nerveux',
      'etudier-cerveau-comportement',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'neurones-communication-plasticite',
      'systemes-nerveux-endocrinien',
      'structures-reseaux-fonctionnels',
      'lesions-neuropsychologie-cas',
      'imagerie-electrophysiologie-inferences',
      'genes-environnement-developpement',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(6);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(18);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(90);
    expect(
      lessons
        .flatMap((lesson) => lesson.resources)
        .every((resource) =>
          ['article', 'book', 'book_chapter', 'document', 'website'].includes(
            resource.type,
          ),
        ),
    ).toBe(true);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('programme fictif'),
      instructions: expect.stringContaining('## Cas CapChange'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la septième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'developpement-vie',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'developpement-vie',
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'cadres-methodes-developpement',
      'fonctions-relations-vie',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'continuite-stades-trajectoires',
      'plans-transversaux-longitudinaux-sequentiels',
      'developpement-prenatal-petite-enfance',
      'developpement-cognitif-langage',
      'attachement-developpement-socioemotionnel',
      'adolescence-age-adulte-vieillissement',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(6);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(18);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(90);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('dossier fictif'),
      instructions: expect.stringContaining('## Cas Trajectoire de Samira'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la huitième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'motivation-emotion-stress',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const assessmentGroups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === 'motivation-emotion-stress',
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'motivation-action',
      'emotion-adaptation',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'besoins-incitations-buts',
      'motivation-intrinseque-extrinseque',
      'autoregulation-habitudes-persistance',
      'composantes-theories-emotion',
      'regulation-emotionnelle',
      'stress-coping-sante',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(assessmentGroups).toHaveLength(6);
    expect(
      assessmentGroups.flatMap((group) => group.assessmentBanks),
    ).toHaveLength(18);
    expect(
      assessmentGroups
        .flatMap((group) => group.assessmentBanks)
        .flatMap((bank) => bank.questions),
    ).toHaveLength(90);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(stage?.assessment).toMatchObject({
      description: expect.stringContaining('cas fictif'),
      instructions: expect.stringContaining('## Cas Parcours de Nora'),
      rubric: expect.any(Array),
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la neuvième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'personnalite-differences-individuelles',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'modeles-personnalite',
      'mesure-interpretation-personnalite',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'approches-traits-big-five',
      'perspectives-biologiques-sociales-narratives',
      'stabilite-changement-situations',
      'fidelite-validite-normes',
      'autoquestionnaires-observation-biais-reponse',
      'usages-limites-ethique-tests',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Horizon 360'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la dixième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'psychologie-sociale',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'percevoir-influencer',
      'relations-groupes',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'cognition-sociale-attribution-attitudes',
      'persuasion-conformite-obeissance',
      'decision-groupe',
      'identites-relations-intergroupes',
      'stereotypes-prejuges-discrimination',
      'cooperation-conflit-prosocialite',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Maison des Passerelles'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la onzième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'psychopathologie',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'definir-classifier',
      'familles-troubles',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'normalite-souffrance-handicap-contexte',
      'classification-diagnostic-comorbidite-limites',
      'modeles-biopsychosociaux-trajectoires',
      'troubles-anxieux-obsessionnels-stress',
      'troubles-depressifs-bipolaires',
      'troubles-psychotiques-neurodeveloppementaux-personnalite',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Repères au Point-Relais'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les six leçons et les dix-huit banques de la douzième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'interventions-applications',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'interventions-psychologiques',
      'psychologie-appliquee',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'evaluation-formulation-decision-partagee',
      'familles-psychotherapies',
      'efficacite-effets-indesirables-alliance-adaptation',
      'sante-prevention',
      'education-apprentissage',
      'travail-ergonomie-organisations',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(6);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(18);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(90);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Cas Campus Horizon'),
      rubric: expect.any(Array),
      type: 'case_study',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('lit les sept leçons et les vingt-et-une banques de la treizième étape', async () => {
    const sampleSeed = await readSampleSeed();
    const stage = sampleSeed.program.stages.find(
      (item) => item.slug === 'integration-preuves',
    );
    const lessons = stage?.modules.flatMap((module) => module.lessons) ?? [];
    const groups = sampleSeed.conceptAssessmentBanks.filter(
      (group) => group.stageSlug === stage?.slug,
    );

    expect(stage?.modules.map((module) => module.slug)).toEqual([
      'science-cumulative-controverses',
      'projet-integrateur',
    ]);
    expect(lessons.map((lesson) => lesson.slug)).toEqual([
      'replication-transparence-science-ouverte',
      'generalisation-diversite-echantillons-contexte-culturel',
      'communication-publique-desinformation-limites-expertise',
      'formuler-question-delimitee',
      'chercher-hierarchiser-sources',
      'comparer-methodes-resultats',
      'rediger-conclusion-proportionnee-preuves',
    ]);
    expect(lessons.every((lesson) => lesson.contentBlocks.length === 6)).toBe(
      true,
    );
    expect(lessons.every((lesson) => lesson.concepts.length === 3)).toBe(true);
    expect(lessons.every((lesson) => lesson.tasks.length === 3)).toBe(true);
    expect(groups).toHaveLength(7);
    expect(groups.flatMap((group) => group.assessmentBanks)).toHaveLength(21);
    expect(
      groups.flatMap((group) =>
        group.assessmentBanks.flatMap((bank) => bank.questions),
      ),
    ).toHaveLength(105);
    expect(stage?.assessment).toMatchObject({
      instructions: expect.stringContaining('## Mandat Observatoire Lucide'),
      rubric: expect.any(Array),
      type: 'project',
    });
    expect(
      stage?.assessment.rubric?.reduce(
        (total, criterion) => total + criterion.weight,
        0,
      ),
    ).toBe(100);
  });

  it('conserve les nouveaux sidecars en revue éditoriale non publiable', async () => {
    type EditorialArtifact = {
      editorial: {
        review: { readyForPublication: boolean };
        status: string;
      };
    };
    const fileNames = [
      ...Array.from(
        { length: 31 },
        (_, index) =>
          `PEDAGOGY_SPEC_${String(index + 40).padStart(3, '0')}.json`,
      ),
      ...Array.from(
        { length: 5 },
        (_, index) =>
          `PEDAGOGY_STAGE_ASSESSMENT_${String(index + 9).padStart(3, '0')}.json`,
      ),
    ];
    const artifacts = await Promise.all(
      fileNames.map(
        async (fileName) =>
          JSON.parse(await readFile(fileName, 'utf8')) as EditorialArtifact,
      ),
    );

    expect(artifacts).toHaveLength(36);
    expect(
      artifacts.every(
        (artifact) =>
          artifact.editorial.status === 'editorial_review' &&
          artifact.editorial.review.readyForPublication === false,
      ),
    ).toBe(true);
  });

  it('synchronise les preuves éditoriales corrigées des étapes initiales', async () => {
    type LessonSidecar = {
      editorial: {
        review: { scientificAccuracy: boolean; subjectReviewer: string | null };
      };
      lesson: {
        contentBlocks: Array<{ content: { sourceKeys: string[] } }>;
      };
    };
    type AssessmentSidecar = {
      editorial: {
        referenceIds: string[];
        review: { subjectReviewer: string | null };
      };
    };
    const [domains, professions, assessment] = await Promise.all([
      readFile('PEDAGOGY_SPEC_002.json', 'utf8'),
      readFile('PEDAGOGY_SPEC_003.json', 'utf8'),
      readFile('PEDAGOGY_STAGE_ASSESSMENT_002.json', 'utf8'),
    ]);
    const lessonSidecars = [domains, professions].map(
      (source) => JSON.parse(source) as LessonSidecar,
    );
    const assessmentSidecar = JSON.parse(assessment) as AssessmentSidecar;

    expect(
      lessonSidecars.flatMap((sidecar) => sidecar.lesson.contentBlocks),
    ).toHaveLength(10);
    expect(
      lessonSidecars
        .flatMap((sidecar) => sidecar.lesson.contentBlocks)
        .every((block) => block.content.sourceKeys.length > 0),
    ).toBe(true);
    expect(
      lessonSidecars.every(
        (sidecar) =>
          sidecar.editorial.review.scientificAccuracy === false &&
          sidecar.editorial.review.subjectReviewer === null,
      ),
    ).toBe(true);
    expect(assessmentSidecar.editorial.review.subjectReviewer).toBeNull();
    expect(assessmentSidecar.editorial.referenceIds).toContain(
      'REF-004-WOZNIAK',
    );
  });

  it('respecte les comptes et relations du lot éditorial intégré', async () => {
    const sampleSeed = await readSampleSeed();
    const stages = sampleSeed.program.stages;
    const modules = stages.flatMap((stage) => stage.modules);
    const lessons = modules.flatMap((module) => module.lessons);
    const concepts = lessons.flatMap((lesson) => lesson.concepts);
    const groups = sampleSeed.conceptAssessmentBanks;
    const banks = groups.flatMap((group) => group.assessmentBanks);

    expect(sampleSeed.program.estimatedDurationDays).toBe(120);
    expect(stages).toHaveLength(13);
    expect(modules).toHaveLength(22);
    expect(lessons).toHaveLength(70);
    expect(stages.every((stage) => stage.assessment)).toBe(true);
    expect(concepts).toHaveLength(210);
    expect(concepts.filter((concept) => concept.assessment)).toHaveLength(210);
    expect(groups).toHaveLength(70);
    expect(banks).toHaveLength(210);
    expect(banks.flatMap((bank) => bank.questions)).toHaveLength(1_050);
    expect(lessons.flatMap((lesson) => lesson.contentBlocks)).toHaveLength(403);
    expect(lessons.flatMap((lesson) => lesson.resources)).toHaveLength(400);
    expect(lessons.flatMap((lesson) => lesson.tasks)).toHaveLength(210);
    const passiveTypes = new Set([
      'reading',
      'watching',
      'listening',
      'checklist',
    ]);
    const canonicalTasks = lessons
      .flatMap((lesson) => lesson.tasks)
      .filter((task) => passiveTypes.has(task.type));
    const canonicalExercises = lessons
      .flatMap((lesson) => lesson.tasks)
      .filter((task) => !passiveTypes.has(task.type));

    expect(canonicalTasks).toHaveLength(8);
    expect(canonicalExercises).toHaveLength(202);
    expect(
      canonicalTasks.every((task) => task.resourceKeys.length > 0),
    ).toBe(true);
    expect(
      canonicalExercises.every((task) => task.resourceKeys.length === 0),
    ).toBe(true);

    for (const lesson of lessons) {
      const resourceKeys = new Set(
        lesson.resources.map((resource) => resource.key),
      );

      expect(
        lesson.contentBlocks.every(
          (block) =>
            block.content.sourceKeys.length > 0 &&
            block.content.sourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
      expect(
        lesson.concepts.every((concept) =>
          concept.resourceKeys.every((key) => resourceKeys.has(key)),
        ),
      ).toBe(true);
    }

    expect(
      stages.every(
        (stage) =>
          stage.assessment.rubric?.reduce(
            (total, criterion) => total + criterion.weight,
            0,
          ) === 100,
      ),
    ).toBe(true);

    for (const group of groups) {
      const stage = stages.find((item) => item.slug === group.stageSlug);
      const module = stage?.modules.find(
        (item) => item.slug === group.moduleSlug,
      );
      const lesson = module?.lessons.find(
        (item) => item.slug === group.lessonSlug,
      );

      expect(lesson).toBeDefined();
      for (const bank of group.assessmentBanks) {
        const concept = lesson?.concepts.find(
          (item) => item.slug === bank.conceptSlug,
        );

        expect(concept?.assessment).toMatchObject({
          questionCount: bank.questions.length,
          title: bank.assessmentTitle,
        });
      }
    }
  });

  it('refuse une source de bloc absente des ressources de la leçon', async () => {
    const sampleSeed = await readSampleSeed();
    const lesson = sampleSeed.program.stages[0].modules[0].lessons[1];

    lesson.contentBlocks[0].content.sourceKeys.push('source-inconnue');

    await expect(
      seedSampleProgram(
        createRepository().repository,
        'user-1',
        sampleSeed.program,
        sampleSeed.conceptAssessmentBanks,
      ),
    ).rejects.toThrow(
      'Content blocks for "grands-domaines" reference unknown resources: source-inconnue.',
    );
  });

  it('upserts the example program without duplicating its hierarchy', async () => {
    const sampleSeed = await readSampleSeed();
    const {
      assessments,
      assessmentQuestions,
      conceptResources,
      concepts,
      contentBlocks,
      exercises,
      lessons,
      modules,
      programs,
      repository,
      resources,
      stages,
      stageAssessments,
      stageAssessmentInputs,
      tasks,
      taskResources,
    } = createRepository();

    await seedSampleProgram(
      repository,
      'user-1',
      sampleSeed.program,
      sampleSeed.conceptAssessmentBanks,
    );
    await seedSampleProgram(
      repository,
      'user-1',
      sampleSeed.program,
      sampleSeed.conceptAssessmentBanks,
    );

    expect(programs).toHaveLength(1);
    expect(stages).toHaveLength(13);
    expect(stageAssessments).toHaveLength(13);
    expect(modules).toHaveLength(22);
    expect(lessons).toHaveLength(70);
    expect(concepts).toHaveLength(210);
    expect(assessments).toHaveLength(210);
    expect(assessmentQuestions).toHaveLength(210);
    expect(
      [...assessmentQuestions.values()].reduce(
        (total, questions) => total + questions.length,
        0,
      ),
    ).toBe(1_050);
    expect(contentBlocks).toHaveLength(403);
    expect(resources).toHaveLength(400);
    expect(tasks).toHaveLength(8);
    expect(exercises).toHaveLength(202);
    expect([...tasks.keys()].some((key) => exercises.has(key))).toBe(false);
    expect(
      [...conceptResources.values()].reduce(
        (total, resourceIds) => total + resourceIds.length,
        0,
      ),
    ).toBe(
      sampleSeed.program.stages
        .flatMap((stage) => stage.modules)
        .flatMap((module) => module.lessons)
        .flatMap((item) => item.concepts)
        .reduce((total, concept) => total + concept.resourceKeys.length, 0),
    );
    const firstLessonId = lessons.get('module-1:definir-la-psychologie');
    const objectConceptId = concepts.get(`${firstLessonId}:objet-psychologie`);
    const behaviorConceptId = concepts.get(
      `${firstLessonId}:comportements-processus-mentaux`,
    );
    const empiricalConceptId = concepts.get(
      `${firstLessonId}:demarche-empirique`,
    );
    const openStaxId = resources.get(
      `${firstLessonId}:openstax-psychology-2e-1-1`,
    );
    const apaId = resources.get(`${firstLessonId}:apa-definition-psychology`);
    const yaleId = resources.get(`${firstLessonId}:yale-psyc110-lecture-1`);

    expect(conceptResources.get(objectConceptId ?? '')).toEqual([
      openStaxId,
      apaId,
    ]);
    expect(conceptResources.get(behaviorConceptId ?? '')).toEqual([
      openStaxId,
      yaleId,
    ]);
    expect(conceptResources.get(empiricalConceptId ?? '')).toEqual([
      openStaxId,
    ]);
    const readingTaskId = tasks.get(`${firstLessonId}:activity-1`);
    expect(taskResources.get(readingTaskId ?? '')).toEqual([openStaxId]);
    const objectAssessmentId = assessments.get(`${objectConceptId}:1`);
    const objectQuestions = assessmentQuestions.get(objectAssessmentId ?? '');

    expect(objectQuestions).toHaveLength(5);
    expect(objectQuestions?.[0]).toMatchObject({
      explanation: expect.any(String),
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true }),
      ]),
    });
    expect(tasks.has(`${firstLessonId}:activity-1`)).toBe(true);
    expect(exercises.has(`${firstLessonId}:activity-1`)).toBe(false);
    expect(exercises.has(`${firstLessonId}:activity-2`)).toBe(true);
    expect(exercises.has(`${firstLessonId}:activity-3`)).toBe(true);
    expect(stageAssessmentInputs.get('stage-1:1')).toMatchObject({
      description: expect.stringContaining('projet d’intervention'),
      instructions: expect.stringContaining('## Cas NovaWork'),
      rubric: expect.arrayContaining([
        expect.objectContaining({ criterion: 'Cadrage scientifique' }),
      ]),
    });
    expect(stageAssessmentInputs.get('stage-2:1')).toMatchObject({
      description: expect.stringContaining('plusieurs explications'),
      instructions: expect.stringContaining('## Cas CampusLang'),
      rubric: expect.arrayContaining([
        expect.objectContaining({
          criterion: 'Exactitude historique et conceptuelle',
        }),
      ]),
    });
    expect(stageAssessmentInputs.get('stage-3:1')).toMatchObject({
      description: expect.stringContaining('fiche critique'),
      instructions: expect.stringContaining('## Cas RespireCampus'),
      rubric: expect.any(Array),
    });
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
