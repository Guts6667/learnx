import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { QuizPage } from '@/pages/QuizPage';

const quizId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function lessonResponse(isPublished = true) {
  return {
    lesson: {
      concepts: [],
      contentBlocks: [],
      estimatedMinutes: 15,
      exercises: [],
      id: 'lesson-1',
      isPublished,
      module: {
        id: 'module-1',
        isPublished,
        slug: 'premiers-pas',
        stage: {
          id: 'stage-1',
          isPublished,
          program: {
            id: 'program-1',
            slug: 'programme-test',
            title: 'Programme test',
          },
          slug: 'introduction',
          title: 'Introduction',
        },
        title: 'Premiers pas',
      },
      navigation: { nextLesson: null, previousLesson: null },
      objectives: [],
      position: 1,
      prerequisites: [],
      quizzes: [
        {
          description: 'Vérifier les quatre formats de réponse.',
          id: quizId,
          isRequired: true,
          passingScore: 75,
          position: 1,
          questionCount: 4,
          title: 'Quiz de la leçon',
        },
      ],
      resources: [],
      slug: 'demarrer',
      summary: 'Résumé',
      tasks: [],
      title: 'Démarrer',
    },
  };
}

function quizResponse() {
  return {
    quiz: {
      description: 'Vérifier les quatre formats de réponse.',
      id: quizId,
      isRequired: true,
      lessonId: 'lesson-1',
      passingScore: 75,
      position: 1,
      questionCount: 4,
      questions: [
        {
          id: questionIds.trueFalse,
          options: [
            { id: optionIds.true, label: 'Vrai', position: 1 },
            { id: optionIds.false, label: 'Faux', position: 2 },
          ],
          position: 1,
          prompt: 'La proposition est-elle vraie ?',
          type: 'TRUE_FALSE',
        },
        {
          id: questionIds.single,
          options: [
            { id: optionIds.singleA, label: 'Intuition', position: 1 },
            { id: optionIds.singleB, label: 'Données', position: 2 },
          ],
          position: 2,
          prompt: 'Choisissez une réponse.',
          type: 'SINGLE_CHOICE',
        },
        {
          id: questionIds.multiple,
          options: [
            { id: optionIds.multipleA, label: 'Temps', position: 1 },
            { id: optionIds.multipleB, label: 'Intuition', position: 2 },
            { id: optionIds.multipleC, label: 'Essais', position: 3 },
          ],
          position: 3,
          prompt: 'Choisissez plusieurs réponses.',
          type: 'MULTIPLE_CHOICE',
        },
        {
          id: questionIds.short,
          options: [],
          position: 4,
          prompt: 'Complétez la phrase.',
          type: 'SHORT_ANSWER',
        },
      ],
      title: 'Quiz de la leçon',
    },
  };
}

function attemptResponse() {
  return {
    attempt: {
      answers: [],
      id: 'attempt-1',
      passed: true,
      score: 100,
      submittedAt: '2026-08-03T08:30:00.000Z',
    },
    corrections: [
      {
        acceptedAnswers: [],
        correct: true,
        correctOptionIds: [optionIds.true],
        explanation: 'La proposition est vraie.',
        questionId: questionIds.trueFalse,
      },
      {
        acceptedAnswers: [],
        correct: true,
        correctOptionIds: [optionIds.singleB],
        explanation: 'Les données sont requises.',
        questionId: questionIds.single,
      },
      {
        acceptedAnswers: [],
        correct: true,
        correctOptionIds: [optionIds.multipleA, optionIds.multipleC],
        explanation: 'Ces indicateurs sont observables.',
        questionId: questionIds.multiple,
      },
      {
        acceptedAnswers: ['données empiriques'],
        correct: true,
        correctOptionIds: [],
        explanation: 'La formulation attendue est correcte.',
        questionId: questionIds.short,
      },
    ],
  };
}

describe('QuizPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parcourt les quatre formats, soumet et affiche le feedback serveur', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer') {
        return Promise.resolve(jsonResponse(lessonResponse()));
      }

      if (path === `/api/quizzes/${quizId}/attempts`) {
        return Promise.resolve(
          init?.method === 'POST'
            ? jsonResponse(attemptResponse(), 201)
            : jsonResponse({ attempts: [] }),
        );
      }

      return Promise.resolve(jsonResponse(quizResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <QuizPage
          lessonSlug="demarrer"
          programSlug="programme-test"
          quizId={quizId}
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Quiz de la leçon',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sommaire' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Leçon : Démarrer' }),
    ).toHaveAttribute('href', '/program/programme-test/lesson/demarrer');
    expect(
      screen.queryByRole('link', { name: 'Programme test' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Introduction' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Premiers pas' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Question 1 sur 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Répondez à cette question',
    );

    fireEvent.click(screen.getByLabelText('Vrai'));
    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    const secondQuestion = await screen.findByText('Choisissez une réponse.');
    await waitFor(() => expect(secondQuestion).toHaveFocus());
    fireEvent.click(screen.getByLabelText('Données'));
    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    fireEvent.click(await screen.findByLabelText('Temps'));
    fireEvent.click(screen.getByLabelText('Essais'));
    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    fireEvent.input(await screen.findByLabelText('Votre réponse'), {
      target: { value: 'Données empiriques' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Envoyer mes réponses' }),
    );

    expect(await screen.findByText('Quiz réussi')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Résultat de l’évaluation')).toHaveFocus(),
    );
    expect(
      screen.getByRole('heading', { name: 'Ce que vos réponses montrent' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Réponses acquises')).toBeInTheDocument();
    expect(screen.getByText('Réponses à renforcer')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Consolider ou poursuivre le parcours',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('100 %')).toBeInTheDocument();
    expect(screen.getByText('La proposition est vraie.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recommencer le quiz' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuer' })).toHaveAttribute(
      'href',
      '/program/programme-test/lesson/demarrer?activity=complete%3Alesson#activity-complete%3Alesson',
    );
    expect(screen.getAllByRole('link', { name: 'Continuer' })).toHaveLength(1);
    expect(
      screen
        .getByLabelText('Résultat de l’évaluation')
        .compareDocumentPosition(
          screen.getByRole('navigation', { name: 'Navigation pédagogique' }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/quizzes/${quizId}/attempts`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('permet de recommencer après une tentative', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string, init?: RequestInit) => {
        if (path === '/api/lessons/demarrer') {
          return Promise.resolve(jsonResponse(lessonResponse()));
        }
        if (path === `/api/quizzes/${quizId}/attempts`) {
          return Promise.resolve(
            init?.method === 'POST'
              ? jsonResponse(attemptResponse(), 201)
              : jsonResponse({ attempts: [] }),
          );
        }
        return Promise.resolve(jsonResponse(quizResponse()));
      }),
    );

    render(
      <AppProviders>
        <QuizPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    await screen.findByText('Question 1 sur 4');
    fireEvent.click(screen.getByLabelText('Vrai'));
    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    fireEvent.click(await screen.findByLabelText('Données'));
    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    fireEvent.click(await screen.findByLabelText('Temps'));
    fireEvent.click(screen.getByLabelText('Essais'));
    fireEvent.click(screen.getByRole('button', { name: 'Question suivante' }));
    fireEvent.input(await screen.findByLabelText('Votre réponse'), {
      target: { value: 'Données empiriques' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Envoyer mes réponses' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Recommencer le quiz' }),
    );

    expect(screen.getByText('Question 1 sur 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Vrai')).not.toBeChecked();
  });

  it('interdit le passage d’un quiz sur une leçon brouillon', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(lessonResponse(false))),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <QuizPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Quiz non publié' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
