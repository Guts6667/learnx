import type { MiddlewareHandler } from 'hono';

import {
  ConceptProgressStatus,
  type PrismaClient,
} from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createConceptAssessmentsApp,
  createPrismaRepository,
  type ConceptAssessmentRepository,
} from '../../src/server/api/concept-assessments/app';

const assessmentId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const conceptId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
const lessonId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const programId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const questionIds = {
  multiple: '97476e0e-2103-40c0-8185-f7601a8d2fd2',
  short: '2ee43f40-0417-48b8-b907-2f505d9500e4',
  single: 'ca1641ec-c177-4191-98d4-da7b70116f7b',
  trueFalse: 'e7f162a6-d202-4c24-a4ce-224bac717909',
};
const optionIds = {
  false: 'a22f15b9-8d34-49d5-ad41-8439899d158f',
  multipleA: '9078d839-afc5-4408-97c6-de29a65834fa',
  multipleB: '67449c8f-4a3b-48f7-b60e-b0910aed67a4',
  multipleC: '772c5160-1f64-490f-91c9-a960a77949fa',
  singleA: '8aab4ca5-fc48-45c5-828b-f04baa81ed6d',
  singleB: '0faf4c1f-a930-4b67-b7bc-9d33e6b5066b',
  true: '985689d1-0682-48d7-8757-9133bb17a49b',
};
const submittedAt = new Date('2026-08-02T22:00:00.000Z');

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

function createAssessment() {
  return {
    concept: {
      id: conceptId,
      lessonId,
      masteryThreshold: 70,
      programId,
      stageId: '58aa6ed5-4984-47c1-902e-020ab72d5824',
      title: 'Démarche empirique',
    },
    id: assessmentId,
    isRequired: true,
    position: 1,
    questions: [
      {
        acceptedAnswers: [],
        explanation: 'La proposition est vraie.',
        id: questionIds.trueFalse,
        options: [
          {
            id: optionIds.true,
            isCorrect: true,
            label: 'Vrai',
            position: 1,
          },
          {
            id: optionIds.false,
            isCorrect: false,
            label: 'Faux',
            position: 2,
          },
        ],
        position: 1,
        prompt: 'La psychologie utilise des observations systématiques.',
        type: 'TRUE_FALSE' as const,
      },
      {
        acceptedAnswers: [],
        explanation: 'Une seule option convient.',
        id: questionIds.single,
        options: [
          {
            id: optionIds.singleA,
            isCorrect: false,
            label: 'Intuition',
            position: 1,
          },
          {
            id: optionIds.singleB,
            isCorrect: true,
            label: 'Données',
            position: 2,
          },
        ],
        position: 2,
        prompt: 'Sur quoi repose une conclusion scientifique ?',
        type: 'SINGLE_CHOICE' as const,
      },
      {
        acceptedAnswers: [],
        explanation: 'Les deux indicateurs sont observables.',
        id: questionIds.multiple,
        options: [
          {
            id: optionIds.multipleA,
            isCorrect: true,
            label: 'Temps consacré',
            position: 1,
          },
          {
            id: optionIds.multipleB,
            isCorrect: false,
            label: 'Lire dans les pensées',
            position: 2,
          },
          {
            id: optionIds.multipleC,
            isCorrect: true,
            label: 'Nombre d’essais',
            position: 3,
          },
        ],
        position: 3,
        prompt: 'Quels indicateurs sont mesurables ?',
        type: 'MULTIPLE_CHOICE' as const,
      },
      {
        acceptedAnswers: ['données empiriques'],
        explanation: 'La démarche scientifique repose sur des données.',
        id: questionIds.short,
        options: [],
        position: 4,
        prompt: 'Complétez : données ...',
        type: 'SHORT_ANSWER' as const,
      },
    ],
    title: 'Mini-évaluation',
  };
}

function passingAnswers() {
  return [
    { optionIds: [optionIds.true], questionId: questionIds.trueFalse },
    { optionIds: [optionIds.singleB], questionId: questionIds.single },
    {
      optionIds: [optionIds.multipleA, optionIds.multipleC],
      questionId: questionIds.multiple,
    },
    {
      optionIds: [],
      questionId: questionIds.short,
      text: 'Données empiriques',
    },
  ];
}

function createRepository(ownerId = userId) {
  const attempts: Array<{
    answers: unknown;
    id: string;
    passed: boolean;
    score: number;
    submittedAt: Date;
  }> = [];
  const records: Parameters<ConceptAssessmentRepository['recordAttempt']>[0][] =
    [];
  const repository: ConceptAssessmentRepository = {
    async findAssessmentForUser(
      requestedAssessmentId,
      requestedUserId,
      preview,
    ) {
      expect(preview).toBe(false);
      return requestedAssessmentId === assessmentId &&
        requestedUserId === ownerId
        ? createAssessment()
        : null;
    },
    async listAttempts() {
      return attempts;
    },
    async recordAttempt(input) {
      records.push(input);
      const attempt = {
        answers: input.answers,
        id: `attempt-${attempts.length + 1}`,
        passed: input.passed,
        score: input.score,
        submittedAt: input.submittedAt,
      };
      const progress = {
        bestScore: input.score,
        lastAttemptAt: input.submittedAt,
        status: input.passed
          ? ConceptProgressStatus.VALIDATED
          : ConceptProgressStatus.NEEDS_REVIEW,
        validatedAt: input.passed ? input.submittedAt : null,
      };

      attempts.unshift(attempt);
      return { attempt, progress };
    },
  };

  return { attempts, records, repository };
}

function jsonRequest(body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  };
}

describe('concept assessment API', () => {
  it('n’expose pas les réponses ni les explications avant soumission', async () => {
    const app = createConceptAssessmentsApp({
      authentication,
      repository: createRepository().repository,
    });
    const response = await app.request(
      `http://localhost/api/concept-assessments/${assessmentId}`,
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('acceptedAnswers');
    expect(serialized).not.toContain('explanation');
  });

  it('autorise explicitement la prévisualisation au propriétaire', async () => {
    const repository = createRepository().repository;
    const findAssessment = vi
      .spyOn(repository, 'findAssessmentForUser')
      .mockImplementation(async (requestedId, requestedUserId, preview) =>
        requestedId === assessmentId && requestedUserId === userId && preview
          ? createAssessment()
          : null,
      );
    const app = createConceptAssessmentsApp({ authentication, repository });
    const response = await app.request(
      `http://localhost/api/concept-assessments/${assessmentId}?preview=true`,
    );

    expect(response.status).toBe(200);
    expect(findAssessment).toHaveBeenCalledWith(assessmentId, userId, true);
  });

  it('refuse la prévisualisation brouillon à un non-propriétaire', async () => {
    const repository = createRepository(otherUserId).repository;
    const findAssessment = vi
      .spyOn(repository, 'findAssessmentForUser')
      .mockImplementation(async () => null);
    const app = createConceptAssessmentsApp({ authentication, repository });
    const response = await app.request(
      `http://localhost/api/concept-assessments/${assessmentId}?preview=true`,
    );

    expect(response.status).toBe(404);
    expect(findAssessment).toHaveBeenCalledWith(assessmentId, userId, true);
  });

  it('autorise le propriétaire à soumettre une tentative en prévisualisation', async () => {
    const { repository } = createRepository();
    const findAssessment = vi
      .spyOn(repository, 'findAssessmentForUser')
      .mockImplementation(async (requestedId, requestedUserId, preview) =>
        requestedId === assessmentId && requestedUserId === userId && preview
          ? createAssessment()
          : null,
      );
    const app = createConceptAssessmentsApp({ authentication, repository });
    const response = await app.request(
      `http://localhost/api/concept-assessments/${assessmentId}/attempts?preview=true`,
      jsonRequest({ answers: passingAnswers() }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      attempt: { passed: true, score: 100 },
    });
    expect(findAssessment).toHaveBeenCalledWith(assessmentId, userId, true);
  });

  it('corrige côté serveur, valide la notion et conserve la tentative', async () => {
    const { attempts, repository } = createRepository();
    const refreshValidation = vi.fn(async () => undefined);
    const app = createConceptAssessmentsApp({
      authentication,
      now: () => submittedAt,
      refreshValidation,
      repository,
    });
    const response = await app.request(
      `http://localhost/api/concept-assessments/${assessmentId}/attempts`,
      jsonRequest({ answers: passingAnswers() }),
    );
    const body = (await response.json()) as {
      corrections: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      attempt: { passed: true, score: 100 },
      progress: { status: 'VALIDATED' },
    });
    expect(body.corrections[0]).toHaveProperty('correctOptionIds');
    expect(attempts).toHaveLength(1);
    expect(refreshValidation).toHaveBeenCalledWith(
      '58aa6ed5-4984-47c1-902e-020ab72d5824',
      userId,
      submittedAt,
    );
  });

  it('passe la notion en révision après échec et programme l’échéance en UTC', async () => {
    const { records, repository } = createRepository();
    const app = createConceptAssessmentsApp({
      authentication,
      now: () => submittedAt,
      repository,
    });
    const answers = passingAnswers();

    answers[0] = {
      optionIds: [optionIds.false],
      questionId: questionIds.trueFalse,
    };
    answers[1] = {
      optionIds: [optionIds.singleA],
      questionId: questionIds.single,
    };
    const response = await app.request(
      `http://localhost/api/concept-assessments/${assessmentId}/attempts`,
      jsonRequest({ answers }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      attempt: { passed: false, score: 50 },
      progress: { status: 'NEEDS_REVIEW' },
    });
    expect(records[0]?.dueAt.toISOString()).toBe('2026-08-03T22:00:00.000Z');
  });

  it('retourne l’historique personnel et permet plusieurs tentatives', async () => {
    const { repository } = createRepository();
    const app = createConceptAssessmentsApp({
      authentication,
      now: () => submittedAt,
      repository,
    });
    const attemptUrl = `http://localhost/api/concept-assessments/${assessmentId}/attempts`;

    await app.request(attemptUrl, jsonRequest({ answers: passingAnswers() }));
    await app.request(attemptUrl, jsonRequest({ answers: passingAnswers() }));
    const history = await app.request(attemptUrl);

    expect(history.status).toBe(200);
    expect(await history.json()).toMatchObject({
      attempts: [{ passed: true }, { passed: true }],
    });
  });

  it('refuse les requêtes anonymes, hors propriété ou invalides', async () => {
    const anonymousApp = createConceptAssessmentsApp({
      repository: createRepository().repository,
    });
    const forbiddenApp = createConceptAssessmentsApp({
      authentication,
      repository: createRepository(otherUserId).repository,
    });
    const validApp = createConceptAssessmentsApp({
      authentication,
      repository: createRepository().repository,
    });
    const url = `http://localhost/api/concept-assessments/${assessmentId}`;

    expect((await anonymousApp.request(url)).status).toBe(401);
    expect((await forbiddenApp.request(url)).status).toBe(404);
    expect(
      (await validApp.request(`${url}/attempts`, jsonRequest({ answers: [] })))
        .status,
    ).toBe(400);
  });
});

describe('concept assessment persistence', () => {
  it('filtre la prévisualisation par propriétaire sans exiger la publication', async () => {
    const findFirst = vi.fn(async () => null);
    const client = {
      conceptAssessment: { findFirst },
    } as unknown as PrismaClient;
    const repository = createPrismaRepository(client);

    await repository.findAssessmentForUser(assessmentId, userId, true);
    expect(findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          concept: {
            lesson: {
              module: {
                stage: {
                  program: {
                    ownerId: userId,
                    status: { in: ['ACTIVE', 'DRAFT'] },
                  },
                },
              },
            },
          },
        }),
      }),
    );

    await repository.findAssessmentForUser(assessmentId, userId, false);
    expect(findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          concept: {
            lesson: {
              isPublished: true,
              module: expect.objectContaining({ isPublished: true }),
            },
          },
        }),
      }),
    );
  });

  function createTransactionClient(currentProgress: object | null = null) {
    const moduleRun = {
      id: 'd0575bf7-b4f7-4ab4-86db-5720d7a63885',
      moduleId: 'ac7cae6f-1888-4698-a049-925c21c23720',
      sequence: 1,
      startedAt: submittedAt,
      userId,
    };
    const reviewUpsert = vi.fn(async () => ({ id: 'review-1' }));
    const reviewUpdateMany = vi.fn(async () => ({ count: 1 }));
    const progressUpsert = vi.fn(async (input: unknown) => {
      const typedInput = input as {
        create: {
          bestScore: number;
          lastAttemptAt: Date;
          status: ConceptProgressStatus;
          validatedAt: Date | null;
        };
        update: {
          bestScore: number;
          status: ConceptProgressStatus;
          validatedAt: Date | null;
        };
      };

      return currentProgress ? typedInput.update : typedInput.create;
    });
    const transaction = {
      conceptAssessment: {
        findFirst: vi.fn(async () => ({ id: assessmentId })),
      },
      lesson: {
        findUnique: vi.fn(async () => ({ moduleId: moduleRun.moduleId })),
      },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
      conceptAssessmentAttempt: {
        create: vi.fn(async () => ({
          answers: [],
          id: 'attempt-1',
          passed: false,
          score: 50,
          submittedAt,
        })),
      },
      conceptProgress: {
        findUnique: vi.fn(async () => currentProgress),
        upsert: progressUpsert,
      },
      reviewItem: {
        updateMany: reviewUpdateMany,
        upsert: reviewUpsert,
      },
    };
    const client = {
      $transaction: async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
    } as unknown as PrismaClient;

    return { client, progressUpsert, reviewUpdateMany, reviewUpsert };
  }

  function recordInput(passed: boolean) {
    return {
      answers: [],
      assessmentId,
      conceptId,
      dueAt: new Date('2026-08-03T22:00:00.000Z'),
      lessonId,
      passed,
      programId,
      preview: false,
      score: passed ? 100 : 50,
      submittedAt,
      userId,
    };
  }

  it('crée une révision après échec', async () => {
    const { client, reviewUpsert } = createTransactionClient();

    await createPrismaRepository(
      client,
      async () => ({}) as never,
    ).recordAttempt(recordInput(false));

    expect(reviewUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceId: assessmentId,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('termine la révision existante après réussite', async () => {
    const { client, reviewUpdateMany, reviewUpsert } =
      createTransactionClient();

    await createPrismaRepository(
      client,
      async () => ({}) as never,
    ).recordAttempt(recordInput(true));

    expect(reviewUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(reviewUpsert).not.toHaveBeenCalled();
  });

  it('ne régresse jamais une notion déjà validée après un nouvel échec', async () => {
    const validatedAt = new Date('2026-08-02T08:00:00.000Z');
    const { client, progressUpsert } = createTransactionClient({
      bestScore: 100,
      status: ConceptProgressStatus.VALIDATED,
      validatedAt,
    });

    await createPrismaRepository(
      client,
      async () => ({}) as never,
    ).recordAttempt(recordInput(false));

    expect(progressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          bestScore: 100,
          status: ConceptProgressStatus.VALIDATED,
          validatedAt,
        }),
      }),
    );
  });
});
