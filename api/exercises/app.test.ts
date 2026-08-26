import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import { learningProgramWhere } from '../../src/server/api/_lib/program-access-policy';
import {
  createExercisesApp,
  createPrismaExerciseRepository,
  type ExerciseRepository,
} from '../../src/server/api/exercises/app';

const exerciseId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const lessonId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const moduleRunId = 'c46c1f22-af45-4490-b8ac-85829c689bd7';
const submissionId = '97476e0e-2103-40c0-8185-f7601a8d2fd2';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const createdAt = new Date('2026-08-03T08:00:00.000Z');
const submittedAt = new Date('2026-08-03T09:00:00.000Z');

const authentication: MiddlewareHandler<AuthEnvironment> = async (
  context,
  next,
) => {
  context.set('user', {
    displayName: 'Learner',
    email: 'learner@example.com',
    id: userId,
    role: 'USER',
  });
  await next();
};

function createRepository(
  ownerId = userId,
  exerciseOptions: {
    activityType?: string;
    language?: string;
    rubric?: unknown;
  } = {},
) {
  let submission:
    | {
        contentMarkdown: string;
        createdAt: Date;
        exerciseId: string;
        id: string;
        moduleRunId: string;
        status: 'DRAFT' | 'SUBMITTED';
        submittedAt: Date | null;
        updatedAt: Date;
        userId: string;
      }
    | undefined;
  let createCalls = 0;
  const repository: ExerciseRepository = {
    async createOrGetSubmission() {
      if (!submission) {
        createCalls += 1;
        submission = {
          contentMarkdown: '',
          createdAt,
          exerciseId,
          id: submissionId,
          moduleRunId,
          status: 'DRAFT',
          submittedAt: null,
          updatedAt: createdAt,
          userId,
        };
      }

      return submission;
    },
    async findExerciseForUser(requestedExerciseId, requestedUserId) {
      if (requestedExerciseId !== exerciseId || requestedUserId !== ownerId) {
        return null;
      }

      return {
        activityType: exerciseOptions.activityType ?? 'WRITING',
        id: exerciseId,
        instructions: 'Rédigez une analyse structurée.',
        isRequired: true,
        key: 'activity-1',
        language: exerciseOptions.language,
        lessonObjectives: ['Produire une analyse structurée.'],
        lessonSlug: 'analyse-appliquee',
        lessonSummary: 'Distinguer une observation et une interprétation.',
        lessonId,
        position: 1,
        programSlug: 'programme-pilote',
        rubric: Object.hasOwn(exerciseOptions, 'rubric')
          ? exerciseOptions.rubric
          : { clarity: true },
        submission: submission ?? null,
        title: 'Analyse appliquée',
      };
    },
    async findOwnedSubmission(requestedSubmissionId, requestedUserId) {
      return requestedSubmissionId === submissionId &&
        requestedUserId === ownerId
        ? (submission ?? null)
        : null;
    },
    async saveSubmission(_requestedSubmissionId, contentMarkdown) {
      if (!submission) throw new Error('Missing submission.');
      submission = { ...submission, contentMarkdown, updatedAt: submittedAt };
      return submission;
    },
    async submitSubmission(_requestedSubmissionId, date) {
      if (!submission) throw new Error('Missing submission.');
      submission = {
        ...submission,
        status: 'SUBMITTED',
        submittedAt: date,
        updatedAt: date,
      };
      return submission;
    },
  };

  return {
    get createCalls() {
      return createCalls;
    },
    get submission() {
      return submission;
    },
    repository,
  };
}

function jsonRequest(body: unknown, method = 'PATCH') {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  };
}

describe('exercise API', () => {
  const publishedWritingContract = {
    authorizedReferences: [],
    contractKey: 'exercise-writing-fr',
    criteria: [
      {
        acceptableVariants: ['Une décision conditionnelle observable.'],
        calibratedExamples: [
          {
            expectedLevelKey: 'mastered',
            rationale: 'La décision est explicite.',
            responseExcerpt: 'Je retiens l’option locale.',
          },
        ],
        commonErrors: ['Reporter le choix.'],
        expectedElements: ['Une option choisie explicitement.'],
        key: 'decision',
        label: 'Décision',
        objective: 'Formuler une décision applicable.',
        performanceLevels: [
          {
            description: 'Aucune décision identifiable.',
            key: 'insufficient',
            label: 'Insuffisant',
            score: 0,
          },
          {
            description: 'Décision explicite et applicable.',
            key: 'mastered',
            label: 'Maîtrisé',
            score: 100,
          },
        ],
        weight: 100,
      },
    ],
    evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
    lifecycle: {
      publishedAt: '2026-08-24T00:00:00+02:00',
      status: 'PUBLISHED',
    },
    objectives: ['Évaluer une décision écrite.'],
    passingScore: 70,
    schemaVersion: 1,
    secondPass: {
      confidenceThreshold: 0.7,
      enabled: true,
      maxPasses: 2,
      triggers: ['LOW_CONFIDENCE'],
    },
    target: {
      activityKey: 'activity-1',
      activityType: 'writing',
      kind: 'EXERCISE',
    },
    version: '1.0.0',
  };

  it('retourne l’exercice publié et le brouillon personnel', async () => {
    const state = createRepository();
    const app = createExercisesApp({
      authentication,
      repository: state.repository,
    });
    await app.request(
      `http://localhost/api/exercises/${exerciseId}/submissions`,
      { method: 'POST' },
    );
    const response = await app.request(
      `http://localhost/api/exercises/${exerciseId}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      exercise: {
        submission: { id: submissionId, status: 'DRAFT' },
        title: 'Analyse appliquée',
      },
    });
  });

  it('n’expose la correction que pour les productions fr-FR au contrat lié', async () => {
    const frenchState = createRepository(userId, {
      language: 'fr-FR',
      rubric: publishedWritingContract,
    });
    const englishState = createRepository(userId, {
      language: 'en-US',
      rubric: publishedWritingContract,
    });
    const frenchApp = createExercisesApp({
      authentication,
      repository: frenchState.repository,
    });
    const englishApp = createExercisesApp({
      authentication,
      repository: englishState.repository,
    });

    const french = await frenchApp.request(
      `http://localhost/api/exercises/${exerciseId}`,
    );
    const english = await englishApp.request(
      `http://localhost/api/exercises/${exerciseId}`,
    );

    expect(await french.json()).toMatchObject({
      exercise: { aiCorrectionEligible: true },
    });
    expect(await english.json()).toMatchObject({
      exercise: { aiCorrectionEligible: false },
    });
  });

  it.each(['WRITING', 'REFLECTION', 'PRACTICE', 'PROJECT'])(
    'génère un contrat publié pour une production %s sans contrat spécialisé',
    async (activityType) => {
      const state = createRepository(userId, {
        activityType,
        language: 'fr-FR',
        rubric: null,
      });
      const app = createExercisesApp({
        authentication,
        repository: state.repository,
      });

      const response = await app.request(
        `http://localhost/api/exercises/${exerciseId}`,
      );

      expect(await response.json()).toMatchObject({
        exercise: { aiCorrectionEligible: true },
      });
    },
  );

  it('crée le brouillon de manière idempotente', async () => {
    const state = createRepository();
    const app = createExercisesApp({
      authentication,
      repository: state.repository,
    });
    const url = `http://localhost/api/exercises/${exerciseId}/submissions`;
    const first = await app.request(url, { method: 'POST' });
    const second = await app.request(url, { method: 'POST' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(state.createCalls).toBe(1);
    expect(await second.json()).toMatchObject({
      submission: { id: submissionId },
    });
  });

  it('sauvegarde un brouillon Markdown, y compris vide', async () => {
    const state = createRepository();
    const app = createExercisesApp({
      authentication,
      repository: state.repository,
    });
    await app.request(
      `http://localhost/api/exercises/${exerciseId}/submissions`,
      { method: 'POST' },
    );
    const url = `http://localhost/api/exercise-submissions/${submissionId}`;
    const empty = await app.request(url, jsonRequest({ contentMarkdown: '' }));
    const saved = await app.request(
      url,
      jsonRequest({ contentMarkdown: '## Analyse\n\nRéponse.' }),
    );

    expect(empty.status).toBe(200);
    expect(saved.status).toBe(200);
    expect(state.submission?.contentMarkdown).toBe('## Analyse\n\nRéponse.');
  });

  it('refuse de sauvegarder ou soumettre une réponse dépassant 1 500 caractères', async () => {
    const state = createRepository();
    const app = createExercisesApp({
      authentication,
      repository: state.repository,
    });
    await app.request(
      `http://localhost/api/exercises/${exerciseId}/submissions`,
      { method: 'POST' },
    );
    const submissionUrl =
      `http://localhost/api/exercise-submissions/${submissionId}`;
    const oversized = 'x'.repeat(1_501);

    expect(
      (await app.request(
        submissionUrl,
        jsonRequest({ contentMarkdown: oversized }),
      )).status,
    ).toBe(400);
    expect(state.submission?.contentMarkdown).toBe('');

    await state.repository.saveSubmission(submissionId, oversized, userId);
    expect(
      (await app.request(`${submissionUrl}/submit`, { method: 'POST' })).status,
    ).toBe(409);
  });

  it('exige un contenu puis soumet avec une date UTC', async () => {
    const state = createRepository();
    const app = createExercisesApp({
      authentication,
      now: () => submittedAt,
      repository: state.repository,
    });
    await app.request(
      `http://localhost/api/exercises/${exerciseId}/submissions`,
      { method: 'POST' },
    );
    const submitUrl = `http://localhost/api/exercise-submissions/${submissionId}/submit`;

    expect((await app.request(submitUrl, { method: 'POST' })).status).toBe(409);
    await app.request(
      `http://localhost/api/exercise-submissions/${submissionId}`,
      jsonRequest({ contentMarkdown: 'Réponse argumentée.' }),
    );
    const response = await app.request(submitUrl, { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      submission: {
        status: 'SUBMITTED',
        submittedAt: submittedAt.toISOString(),
      },
    });
  });

  it('refuse toute modification après soumission', async () => {
    const state = createRepository();
    const app = createExercisesApp({
      authentication,
      repository: state.repository,
    });
    await app.request(
      `http://localhost/api/exercises/${exerciseId}/submissions`,
      { method: 'POST' },
    );
    await app.request(
      `http://localhost/api/exercise-submissions/${submissionId}`,
      jsonRequest({ contentMarkdown: 'Réponse.' }),
    );
    await app.request(
      `http://localhost/api/exercise-submissions/${submissionId}/submit`,
      { method: 'POST' },
    );

    expect(
      (
        await app.request(
          `http://localhost/api/exercise-submissions/${submissionId}`,
          jsonRequest({ contentMarkdown: 'Modification.' }),
        )
      ).status,
    ).toBe(409);
  });

  it('refuse les accès anonymes, hors propriété et invalides', async () => {
    const anonymousApp = createExercisesApp({
      repository: createRepository().repository,
    });
    const forbiddenApp = createExercisesApp({
      authentication,
      repository: createRepository(otherUserId).repository,
    });
    const validApp = createExercisesApp({
      authentication,
      repository: createRepository().repository,
    });
    const url = `http://localhost/api/exercises/${exerciseId}`;

    expect((await anonymousApp.request(url)).status).toBe(401);
    expect((await forbiddenApp.request(url)).status).toBe(404);
    expect((await validApp.request('/api/exercises/not-a-uuid')).status).toBe(
      400,
    );
  });
});

describe('exercise persistence filters', () => {
  it('filtre la hiérarchie publiée, le programme actif et le propriétaire', async () => {
    const findFirst = vi.fn(async () => null);
    const repository = createPrismaExerciseRepository({
      exercise: { findFirst },
    } as unknown as PrismaClient);

    await repository.findExerciseForUser(exerciseId, userId);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: exerciseId,
          isCanonical: true,
          lesson: {
            isPublished: true,
            module: {
              isPublished: true,
              stage: {
                isPublished: true,
                program: learningProgramWhere(userId),
              },
            },
          },
        },
      }),
    );
  });

  it('recalcule la progression à la soumission dans la même transaction', async () => {
    const currentRun = {
      id: moduleRunId,
      moduleId: 'ac7cae6f-1888-4698-a049-925c21c23720',
      sequence: 1,
      startedAt: createdAt,
      userId,
    };
    const transaction = {
      lesson: {
        findUnique: vi.fn(async () => ({ moduleId: currentRun.moduleId })),
      },
      moduleRun: { findFirst: vi.fn(async () => currentRun) },
      exerciseSubmission: {
        findFirst: vi.fn(async () => ({
          contentMarkdown: 'Réponse.',
          exercise: { lessonId },
          moduleRunId,
          status: 'DRAFT' as const,
        })),
        update: vi.fn(async () => ({
          contentMarkdown: 'Réponse.',
          createdAt,
          exerciseId,
          id: submissionId,
          moduleRunId,
          status: 'SUBMITTED' as const,
          submittedAt,
          updatedAt: submittedAt,
          userId,
        })),
      },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    } as unknown as PrismaClient;
    const recalculate = vi.fn(async () => ({}) as never);

    await createPrismaExerciseRepository(client, recalculate).submitSubmission(
      submissionId,
      submittedAt,
      userId,
    );

    expect(recalculate).toHaveBeenCalledWith(
      transaction,
      lessonId,
      userId,
      submittedAt,
      { requirePublished: true },
    );
  });
});
