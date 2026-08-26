import { fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { ExercisePage } from '@/pages/ExercisePage';

const exerciseId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
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
      if (path === '/api/lessons/demarrer') {
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
        <ExercisePage
          exerciseId={exerciseId}
          lessonSlug="demarrer"
          programSlug="programme-test"
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Analyse appliquée',
      }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Sommaire' }));
    expect(
      await screen.findByRole('dialog', { name: 'Sommaire de la leçon' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Analyse appliquée/ }),
    ).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    const startExercise = await screen.findByRole('button', {
      name: 'Commencer l’exercice',
    });
    const pedagogicalNavigation = screen.getByRole('navigation', {
      name: 'Navigation pédagogique',
    });
    expect(startExercise).toBeInTheDocument();
    expect(
      startExercise.compareDocumentPosition(pedagogicalNavigation) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Continuer' })).toHaveLength(1);
    expect(window.localStorage.getItem('learnx:lesson-activity:lesson-1')).toBe(
      `exercise:${exerciseId}`,
    );
  });

  it('ne charge pas un exercice absent de la leçon accessible', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(lessonResponse())),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ExercisePage
          exerciseId="exercise-inconnu"
          lessonSlug="demarrer"
          programSlug="programme-test"
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Exercice introuvable' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('permet de reprendre le chargement sans quitter la route profonde', async () => {
    let lessonRequests = 0;
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/lessons/demarrer') {
        lessonRequests += 1;
        return Promise.resolve(
          lessonRequests === 1
            ? jsonResponse({ error: 'temporary' }, 503)
            : jsonResponse(lessonResponse()),
        );
      }
      if (path === `/api/exercises/${exerciseId}`) {
        return Promise.resolve(
          jsonResponse({
            exercise: {
              ...lessonResponse().lesson.exercises[0],
              aiCorrectionEligible: false,
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
        <ExercisePage
          exerciseId={exerciseId}
          lessonSlug="demarrer"
          programSlug="programme-test"
        />
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Analyse appliquée',
      }),
    ).toBeInTheDocument();
    expect(lessonRequests).toBe(2);
  });
});
