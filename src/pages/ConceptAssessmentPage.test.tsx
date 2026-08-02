import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { ConceptAssessmentPage } from '@/pages/ConceptAssessmentPage';

const assessmentId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const questionId = 'e7f162a6-d202-4c24-a4ce-224bac717909';
const trueId = '985689d1-0682-48d7-8757-9133bb17a49b';
const falseId = 'a22f15b9-8d34-49d5-ad41-8439899d158f';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function lessonResponse(isPublished: boolean) {
  return {
    lesson: {
      concepts: [
        {
          assessments: [
            {
              id: assessmentId,
              isRequired: true,
              position: 1,
              questionCount: 1,
              title: 'Mini-évaluation — Démarche empirique',
            },
          ],
          id: 'concept-1',
          isRequired: true,
          masteryThreshold: 70,
          position: 1,
          slug: 'demarche-empirique',
          title: 'Démarche empirique',
        },
      ],
      contentBlocks: [],
      estimatedMinutes: 15,
      exercises: [],
      id: 'lesson-1',
      isPublished,
      objectives: [],
      position: 1,
      prerequisites: [],
      quizzes: [],
      resources: [],
      slug: 'demarrer',
      summary: 'Résumé',
      tasks: [],
      title: 'Démarrer',
    },
  };
}

function assessmentResponse() {
  return {
    assessment: {
      concept: {
        id: 'concept-1',
        lessonId: 'lesson-1',
        masteryThreshold: 70,
        programId: 'program-1',
        stageId: 'stage-1',
        title: 'Démarche empirique',
      },
      id: assessmentId,
      isRequired: true,
      position: 1,
      questionCount: 1,
      questions: [
        {
          id: questionId,
          options: [
            { id: trueId, label: 'Vrai', position: 1 },
            { id: falseId, label: 'Faux', position: 2 },
          ],
          position: 1,
          prompt: 'La psychologie repose sur des données.',
          type: 'TRUE_FALSE',
        },
      ],
      title: 'Mini-évaluation — Démarche empirique',
    },
  };
}

describe('ConceptAssessmentPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('permet au propriétaire de passer une banque brouillon via la prévisualisation', async () => {
    const basePath = `/api/concept-assessments/${assessmentId}`;
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer?preview=true') {
        return Promise.resolve(jsonResponse(lessonResponse(false)));
      }
      if (path === `${basePath}?preview=true`) {
        return Promise.resolve(jsonResponse(assessmentResponse()));
      }
      if (path === `${basePath}/attempts?preview=true`) {
        if (init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              {
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
                    correctOptionIds: [trueId],
                    explanation: 'Les données sont indispensables.',
                    questionId,
                  },
                ],
              },
              201,
            ),
          );
        }

        return Promise.resolve(jsonResponse({ attempts: [] }));
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ConceptAssessmentPage
          assessmentId={assessmentId}
          lessonSlug="demarrer"
          programSlug="programme-test"
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Mini-évaluation — Démarche empirique',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    expect(
      screen.queryByText('Les données sont indispensables.'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Vrai'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Envoyer mes réponses' }),
    );

    expect(
      await screen.findByText('Les données sont indispensables.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `${basePath}/attempts?preview=true`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('utilise les endpoints publics stricts quand la leçon est publiée', async () => {
    const basePath = `/api/concept-assessments/${assessmentId}`;
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/lessons/demarrer?preview=true') {
        return Promise.resolve(jsonResponse(lessonResponse(true)));
      }
      if (path === basePath) {
        return Promise.resolve(jsonResponse(assessmentResponse()));
      }
      if (path === `${basePath}/attempts`) {
        return Promise.resolve(jsonResponse({ attempts: [] }));
      }

      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ConceptAssessmentPage
          assessmentId={assessmentId}
          lessonSlug="demarrer"
          programSlug="programme-test"
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Mini-évaluation — Démarche empirique',
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(basePath, expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith(
      `${basePath}?preview=true`,
      expect.anything(),
    );
  });
});
