import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createPrismaRepository,
  createQuizzesApp,
  type QuizRepository,
} from '../../src/server/api/quizzes/app';

const quizId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const lessonId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const submittedAt = new Date('2026-08-03T08:30:00.000Z');
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

function createQuiz() {
  return {
    description: 'Vérifier les acquis de la leçon.',
    id: quizId,
    isRequired: true,
    lessonId,
    passingScore: 75,
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
    title: 'Quiz de la leçon',
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
  const records: Parameters<QuizRepository['recordAttempt']>[0][] = [];
  const repository: QuizRepository = {
    async findPublishedQuizForUser(requestedQuizId, requestedUserId) {
      return requestedQuizId === quizId && requestedUserId === ownerId
        ? createQuiz()
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

      attempts.unshift(attempt);
      return attempt;
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

describe('quiz API', () => {
  it('n’expose aucune réponse ni explication avant soumission', async () => {
    const app = createQuizzesApp({
      authentication,
      repository: createRepository().repository,
    });
    const response = await app.request(
      `http://localhost/api/quizzes/${quizId}`,
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('acceptedAnswers');
    expect(serialized).not.toContain('explanation');
  });

  it('calcule le résultat côté serveur et conserve la tentative', async () => {
    const { records, repository } = createRepository();
    const app = createQuizzesApp({
      authentication,
      now: () => submittedAt,
      repository,
    });
    const response = await app.request(
      `http://localhost/api/quizzes/${quizId}/attempts`,
      jsonRequest({ answers: passingAnswers() }),
    );
    const body = (await response.json()) as {
      corrections: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ attempt: { passed: true, score: 100 } });
    expect(body.corrections[0]).toHaveProperty('correctOptionIds');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ quizId, submittedAt, userId });
  });

  it('applique le seuil du quiz sans faire confiance au client', async () => {
    const { repository } = createRepository();
    const app = createQuizzesApp({ authentication, repository });
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
      `http://localhost/api/quizzes/${quizId}/attempts`,
      jsonRequest({ answers, passed: true, score: 100 }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      attempt: { passed: false, score: 50 },
    });
  });

  it('retourne uniquement l’historique personnel et conserve les reprises', async () => {
    const { repository } = createRepository();
    const app = createQuizzesApp({ authentication, repository });
    const url = `http://localhost/api/quizzes/${quizId}/attempts`;

    await app.request(url, jsonRequest({ answers: passingAnswers() }));
    await app.request(url, jsonRequest({ answers: passingAnswers() }));
    const response = await app.request(url);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      attempts: [{ passed: true }, { passed: true }],
    });
  });

  it('refuse les requêtes anonymes, hors propriété ou invalides', async () => {
    const anonymousApp = createQuizzesApp({
      repository: createRepository().repository,
    });
    const forbiddenApp = createQuizzesApp({
      authentication,
      repository: createRepository(otherUserId).repository,
    });
    const validApp = createQuizzesApp({
      authentication,
      repository: createRepository().repository,
    });
    const url = `http://localhost/api/quizzes/${quizId}`;

    expect((await anonymousApp.request(url)).status).toBe(401);
    expect((await forbiddenApp.request(url)).status).toBe(404);
    expect(
      (await validApp.request(`${url}/attempts`, jsonRequest({ answers: [] })))
        .status,
    ).toBe(400);
    expect((await validApp.request('/api/quizzes/not-a-uuid')).status).toBe(
      400,
    );
  });
});

describe('quiz persistence filters', () => {
  it('filtre la hiérarchie publiée, le programme actif et le propriétaire', async () => {
    const findFirst = vi.fn(async () => null);
    const repository = createPrismaRepository({
      quiz: { findFirst },
    } as unknown as PrismaClient);

    await repository.findPublishedQuizForUser(quizId, userId);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: quizId,
          lesson: {
            isPublished: true,
            module: {
              isPublished: true,
              stage: {
                isPublished: true,
                program: { ownerId: userId, status: 'ACTIVE' },
              },
            },
          },
        },
      }),
    );
  });

  it('recalcule la progression dans la transaction de tentative', async () => {
    const moduleRun = {
      id: 'd0575bf7-b4f7-4ab4-86db-5720d7a63885',
      moduleId: 'ac7cae6f-1888-4698-a049-925c21c23720',
      sequence: 1,
      startedAt: submittedAt,
      userId,
    };
    const create = vi.fn(async () => ({
      answers: [],
      id: 'attempt-1',
      passed: true,
      score: 100,
      submittedAt,
    }));
    const transaction = {
      lesson: {
        findUnique: vi.fn(async () => ({ moduleId: moduleRun.moduleId })),
      },
      moduleRun: { findFirst: vi.fn(async () => moduleRun) },
      quizAttempt: { create },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    } as unknown as PrismaClient;
    const recalculate = vi.fn(async () => ({}) as never);

    await createPrismaRepository(client, recalculate).recordAttempt({
      answers: [],
      lessonId,
      passed: true,
      quizId,
      score: 100,
      submittedAt,
      userId,
    });

    expect(recalculate).toHaveBeenCalledWith(
      transaction,
      lessonId,
      userId,
      submittedAt,
      { requirePublished: true },
    );
  });
});
