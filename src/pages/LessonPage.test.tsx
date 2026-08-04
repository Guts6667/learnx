import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { LessonPage } from '@/pages/LessonPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function lessonResponse(isPublished: boolean, isLocked = false) {
  return {
    lesson: {
      concepts: [
        {
          assessments: [
            {
              id: 'assessment-1',
              isRequired: true,
              position: 1,
              questionCount: 5,
              title: 'Mini-évaluation — Comprendre',
            },
          ],
          id: 'concept-1',
          isRequired: true,
          masteryThreshold: 70,
          position: 1,
          slug: 'comprendre',
          title: 'Comprendre',
        },
      ],
      contentBlocks: [
        {
          content: {
            sourceKeys: ['article-reference', 'unsafe-reference'],
            text: 'Le contenu pédagogique.',
          },
          id: 'block-1',
          position: 1,
          type: 'RICH_TEXT',
        },
      ],
      estimatedMinutes: 15,
      exercises: [
        {
          id: 'exercise-1',
          instructions: 'Appliquer la notion.',
          isRequired: true,
          position: 1,
          rubric: null,
          title: 'Mise en pratique',
        },
      ],
      id: 'lesson-1',
      isLocked,
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
      navigation: {
        nextLesson: {
          estimatedMinutes: 20,
          id: 'lesson-2',
          isPublished,
          position: 2,
          slug: 'approfondir',
          summary: 'Aller plus loin.',
          title: 'Approfondir',
        },
        previousLesson: null,
      },
      objectives: ['Comprendre la notion'],
      position: 1,
      prerequisites: [],
      quizzes: [
        {
          description: 'Vérifier les acquis.',
          id: 'quiz-1',
          isRequired: true,
          passingScore: 70,
          position: 1,
          questionCount: 4,
          title: 'Quiz de la leçon',
        },
      ],
      resources: [
        {
          author: 'Ada Lovelace',
          citation: null,
          description: 'Une lecture complémentaire.',
          estimatedMinutes: 5,
          id: 'resource-1',
          isRequired: true,
          key: 'article-reference',
          position: 1,
          title: 'Article de référence',
          type: 'ARTICLE',
          url: 'https://example.com/article',
        },
        {
          author: 'Source inconnue',
          citation: 'Citation non navigable',
          description: null,
          estimatedMinutes: null,
          id: 'resource-2',
          isRequired: false,
          key: 'unsafe-reference',
          position: 2,
          title: 'Source non sûre',
          type: 'WEBSITE',
          url: 'javascript:alert(1)',
        },
      ],
      slug: 'demarrer',
      summary: 'Les notions essentielles.',
      tasks: [
        {
          description: 'Écrire une synthèse courte.',
          id: 'task-1',
          isRequired: true,
          position: 1,
          title: 'Synthétiser',
          type: 'WRITING',
          weight: 1,
        },
      ],
      title: 'Démarrer',
    },
  };
}

function progressResponse(taskStatus: 'DONE' | 'TODO' = 'TODO') {
  return {
    canComplete: false,
    conceptProgress: {},
    exerciseSubmissions: {},
    lessonProgress: {
      completedAt: null,
      percent: taskStatus === 'DONE' ? 20 : 0,
      startedAt: '2026-08-03T08:00:00.000Z',
      status: 'IN_PROGRESS',
    },
    quizPassed: {},
    resourceProgress: {},
    taskCompletions: { 'task-1': taskStatus },
  };
}

describe('LessonPage', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  });

  it('unifie le contenu et son sommaire en prévisualisation brouillon', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/notes' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ note: { id: 'note-1' } }));
      }
      return Promise.resolve(jsonResponse(lessonResponse(false)));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Démarrer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Le contenu pédagogique.')).toBeInTheDocument();
    expect(screen.getByText('Sources de ce bloc')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ouvrir la source' }),
    ).toHaveAttribute('href', 'https://example.com/article');
    expect(screen.getByText(/Source non sûre/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Ouvrir la source' }),
    ).toHaveLength(1);
    expect(
      screen.getByText('Prévisualisation en lecture seule'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navigation pédagogique' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Retour à la leçon' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sommaire' }));
    expect(
      await screen.findByRole('dialog', { name: 'Sommaire de la leçon' }),
    ).toHaveTextContent('Synthétiser');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    expect(
      screen.getByRole('link', { name: 'Programme test' }),
    ).toHaveAttribute('href', '/program/programme-test');
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/lessons/lesson-1/progress',
      expect.anything(),
    );
    expect(
      screen.getByRole('button', { name: 'Continuer la prévisualisation' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Prendre une note liée' }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({
          body: JSON.stringify({
            lessonId: 'lesson-1',
            title: 'Notes — Démarrer',
          }),
          method: 'POST',
        }),
      ),
    );
  });

  it('restaure une tâche profonde et met sa progression à jour', async () => {
    window.history.replaceState(
      null,
      '',
      '/program/programme-test/lesson/demarrer?activity=task%3Atask-1',
    );
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer?preview=true') {
        return Promise.resolve(jsonResponse(lessonResponse(true)));
      }
      if (path === '/api/lessons/lesson-1/progress') {
        return Promise.resolve(jsonResponse(progressResponse()));
      }
      if (path === '/api/tasks/task-1' && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(progressResponse('DONE')));
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Synthétiser' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Marquer comme terminée' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Marquer comme à faire' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({
        body: JSON.stringify({ status: 'DONE' }),
        method: 'PATCH',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sommaire' }));
    expect(
      screen.getByRole('link', { name: /Mini-évaluation — Comprendre/ }),
    ).toHaveAttribute(
      'href',
      '/program/programme-test/lesson/demarrer/assessment?assessmentId=assessment-1&activity=concept_assessment%3Aassessment-1',
    );
  });

  it('explique le verrouillage sans charger ni muter la progression', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(lessonResponse(true, true))),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Leçon verrouillée' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir les prérequis' }),
    ).toHaveAttribute('href', '/program/programme-test/stage/introduction');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('affiche un état hors ligne explicite sans simuler de progression', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) =>
        path === '/api/lessons/demarrer?preview=true'
          ? Promise.resolve(jsonResponse(lessonResponse(true)))
          : Promise.reject(new TypeError('Network unavailable')),
      ),
    );

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Leçon indisponible hors ligne',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aucune progression n’a été simulée/),
    ).toBeInTheDocument();
  });
});
