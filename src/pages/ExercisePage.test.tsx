import { render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { ExercisePage } from '@/pages/ExercisePage';

const exerciseId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function lessonResponse() {
  return {
    lesson: {
      concepts: [],
      contentBlocks: [],
      estimatedMinutes: 15,
      exercises: [
        {
          id: exerciseId,
          instructions: 'Rédigez une analyse structurée.',
          isRequired: true,
          position: 1,
          rubric: null,
          title: 'Analyse appliquée',
        },
      ],
      id: 'lesson-1',
      isPublished: true,
      module: {
        id: 'module-1',
        isPublished: true,
        slug: 'premiers-pas',
        stage: {
          id: 'stage-1',
          isPublished: true,
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
      quizzes: [],
      resources: [],
      slug: 'demarrer',
      summary: 'Résumé',
      tasks: [],
      title: 'Démarrer',
    },
  };
}

describe('ExercisePage', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('conserve le contexte de leçon sur une route profonde canonique', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/lessons/demarrer?preview=true') {
        return Promise.resolve(jsonResponse(lessonResponse()));
      }
      if (path === `/api/exercises/${exerciseId}`) {
        return Promise.resolve(
          jsonResponse({
            exercise: {
              ...lessonResponse().lesson.exercises[0],
              lessonId: 'lesson-1',
              submission: null,
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ExercisePage exerciseId={exerciseId} lessonSlug="demarrer" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Analyse appliquée' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Programme test' })).toHaveAttribute(
      'href',
      '/program/programme-test',
    );
    expect(screen.getByRole('link', { name: 'Retour à la leçon' })).toHaveAttribute(
      'href',
      `/program/programme-test/lesson/demarrer?activity=exercise%3A${exerciseId}`,
    );
    expect(screen.getByText('Sommaire de la leçon')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Analyse appliquée' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(await screen.findByRole('button', { name: 'Commencer l’exercice' })).toBeInTheDocument();
    expect(window.localStorage.getItem('learnx:lesson-activity:lesson-1')).toBe(
      `exercise:${exerciseId}`,
    );
  });

  it('ne charge pas un exercice absent de la leçon accessible', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(lessonResponse())));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ExercisePage exerciseId="exercise-inconnu" lessonSlug="demarrer" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Exercice introuvable' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
