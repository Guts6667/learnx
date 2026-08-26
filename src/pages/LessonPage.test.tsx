import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { LessonPage } from '@/pages/LessonPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function lessonResponse(
  isPublished: boolean,
  isLocked = false,
  hasNextLesson = true,
) {
  return {
    lesson: {
      concepts: [
        {
          assessments: [
            {
              id: 'assessment-1',
              key: 'assessment-1',
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
            text: '# Repère pédagogique\n\nLe contenu pédagogique.',
          },
          id: 'block-1',
          key: 'content-1',
          position: 1,
          type: 'RICH_TEXT',
        },
      ],
      estimatedMinutes: 15,
      exercises: [
        {
          activityType: 'PRACTICE',
          id: 'exercise-1',
          instructions: 'Appliquer la notion.',
          isRequired: true,
          key: 'activity-2',
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
        nextLesson: hasNextLesson
          ? {
              estimatedMinutes: 20,
              id: 'lesson-2',
              isPublished,
              position: 2,
              slug: 'approfondir',
              summary: 'Aller plus loin.',
              title: 'Approfondir',
            }
          : null,
        previousLesson: null,
      },
      objectives: ['Comprendre la notion'],
      position: 1,
      prerequisites: [],
      quizzes: [
        {
          description: 'Vérifier les acquis.',
          id: 'quiz-1',
          key: 'quiz-1',
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
          guidance: {
            alternativeResourceKey: null,
            instructions: 'Lire la section 1 et relever une définition.',
            objective: 'Identifier la définition de référence.',
            scope: 'Section 1',
            urlStatus: 'ok',
          },
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
          guidance: {
            alternativeResourceKey: 'article-reference',
            instructions: 'Consulter la page de référence.',
            objective: 'Approfondir la notion.',
            scope: null,
            urlStatus: 'broken',
          },
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
      sequence: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          kind: 'CONTENT',
          key: 'content-1',
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          kind: 'RESOURCE',
          key: 'article-reference',
        },
        {
          id: '10000000-0000-4000-8000-000000000003',
          kind: 'TASK',
          key: 'activity-1',
        },
        {
          id: '10000000-0000-4000-8000-000000000004',
          kind: 'CONCEPT_ASSESSMENT',
          key: 'assessment-1',
        },
        {
          id: '10000000-0000-4000-8000-000000000005',
          kind: 'EXERCISE',
          key: 'activity-2',
        },
        {
          id: '10000000-0000-4000-8000-000000000006',
          kind: 'QUIZ',
          key: 'quiz-1',
        },
      ],
      summary: 'Les notions essentielles.',
      tasks: [
        {
          description: 'Lire la source de référence.',
          id: 'task-1',
          isRequired: true,
          key: 'activity-1',
          position: 1,
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
          ],
          title: 'Lire la référence',
          type: 'READING',
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

function completableProgressResponse(isCompleted: boolean) {
  return {
    canComplete: true,
    conceptProgress: { 'concept-1': 'VALIDATED' },
    exerciseSubmissions: { 'exercise-1': 'SUBMITTED' },
    lessonProgress: {
      completedAt: isCompleted ? '2026-08-03T09:00:00.000Z' : null,
      percent: isCompleted ? 100 : 90,
      startedAt: '2026-08-03T08:00:00.000Z',
      status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
    },
    quizPassed: { 'quiz-1': true },
    resourceProgress: { 'resource-1': 'COMPLETED' },
    taskCompletions: { 'task-1': 'DONE' },
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
        return Promise.resolve(
          jsonResponse({
            note: {
              createdAt: '2026-08-09T00:00:00.000Z',
              id: 'note-1',
              lesson: {
                id: 'lesson-1',
                slug: 'demarrer',
                title: 'Démarrer',
              },
              markdown: '',
              program: {
                id: 'program-1',
                slug: 'programme-test',
                title: 'Programme test',
              },
              sequenceItem: {
                id: '10000000-0000-4000-8000-000000000001',
                key: 'content-1',
                kind: 'CONTENT',
              },
              title: 'Notes — Démarrer',
              updatedAt: '2026-08-09T00:00:00.000Z',
            },
          }),
        );
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
    expect(
      screen.getAllByRole('heading', { name: 'Repère pédagogique' }),
    ).toHaveLength(1);
    expect(screen.getByText('Sources de ce contenu')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ouvrir la source' }),
    ).toHaveAttribute('href', 'https://example.com/article');
    expect(screen.getByRole('link', { name: 'Ouvrir la source' })).toHaveClass(
      'underline',
    );
    expect(screen.getAllByText(/Source non sûre/)).toHaveLength(1);
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
    ).toHaveTextContent('Lire la référence');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    expect(
      screen.queryByRole('link', { name: 'Programme test' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Introduction' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Premiers pas' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Leçon : Démarrer' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/lessons/lesson-1/progress',
      expect.anything(),
    );
    const content = screen.getByText('Le contenu pédagogique.');
    const navigation = screen.getByRole('navigation', {
      name: 'Navigation pédagogique',
    });
    const noteButton = screen.getByRole('button', {
      name: 'Prendre une note',
    });
    const previous = screen.getByText('Précédent');
    const continueButton = screen.getByRole('button', { name: 'Continuer' });

    expect(content.compareDocumentPosition(navigation)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(noteButton.compareDocumentPosition(navigation)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getAllByText('Continuer')).toHaveLength(1);
    expect(
      screen.queryByRole('link', { name: 'Continuer' }),
    ).not.toBeInTheDocument();
    expect(previous.parentElement).toBe(continueButton.parentElement);
    expect(previous.parentElement).toHaveClass(
      'pedagogical-navigation__actions',
    );
    expect(previous.compareDocumentPosition(continueButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prendre une note' }));
    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, init]) => path === '/api/notes' && init?.method === 'POST',
      );
      expect(request).toBeDefined();
      expect(JSON.parse(String(request?.[1]?.body))).toEqual({
        creationKey: expect.any(String),
        lessonId: 'lesson-1',
        sequenceItemId: '10000000-0000-4000-8000-000000000001',
        title: 'Notes — Démarrer',
      });
    });
  });

  it('rend une ressource guidée à sa position et persiste sa consultation', async () => {
    window.history.replaceState(
      null,
      '',
      '/program/programme-test/lesson/demarrer?activity=resource%3Aresource-1',
    );
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer')
        return Promise.resolve(jsonResponse(lessonResponse(true)));
      if (path === '/api/lessons/lesson-1/progress')
        return Promise.resolve(jsonResponse(progressResponse()));
      if (
        path === '/api/resources/resource-1/progress' &&
        init?.method === 'PATCH'
      ) {
        return Promise.resolve(
          jsonResponse({
            ...progressResponse(),
            resourceProgress: { 'resource-1': 'COMPLETED' },
          }),
        );
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
      await screen.findByRole('heading', { name: 'Article de référence' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Ressources de la leçon'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Identifier la définition de référence.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Section 1/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ouvrir la lecture' }),
    ).toHaveAttribute('href', 'https://example.com/article');
    fireEvent.click(
      screen.getByRole('button', { name: 'Marquer comme consultée' }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/resources/resource-1/progress',
        expect.objectContaining({
          body: JSON.stringify({ status: 'COMPLETED' }),
          method: 'PATCH',
        }),
      ),
    );
  });

  it('remplace Terminer la leçon par Leçon suivante après la réussite serveur', async () => {
    window.history.replaceState(
      null,
      '',
      '/program/programme-test/lesson/demarrer?activity=complete%3Alesson',
    );
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer') {
        return Promise.resolve(jsonResponse(lessonResponse(true)));
      }
      if (path === '/api/lessons/lesson-1/progress') {
        return Promise.resolve(
          jsonResponse(completableProgressResponse(false)),
        );
      }
      if (
        path === '/api/lessons/lesson-1/complete' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(jsonResponse(completableProgressResponse(true)));
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    const completeButton = await screen.findByRole('button', {
      name: 'Terminer la leçon',
    });
    expect(screen.getAllByText('Terminer la leçon')).toHaveLength(2);
    fireEvent.click(completeButton);

    expect(
      await screen.findByRole('link', { name: 'Leçon suivante' }),
    ).toHaveAttribute('href', '/program/programme-test/lesson/approfondir');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/lessons/lesson-1/complete',
      expect.objectContaining({ method: 'POST' }),
    );
    const nextLessonLink = screen.getByRole('link', {
      name: 'Leçon suivante',
    });
    expect(
      screen.getAllByRole('link', { name: 'Leçon suivante' }),
    ).toHaveLength(1);
    expect(nextLessonLink).toHaveClass('ui-action', 'ui-action--primary');
  });

  it('revient au programme et à la bonne étape après la dernière leçon', async () => {
    window.history.replaceState(
      null,
      '',
      '/program/programme-test/lesson/demarrer?activity=complete%3Alesson',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (path === '/api/lessons/demarrer') {
          return Promise.resolve(
            jsonResponse(lessonResponse(true, false, false)),
          );
        }
        if (path === '/api/lessons/lesson-1/progress') {
          return Promise.resolve(
            jsonResponse(completableProgressResponse(true)),
          );
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('link', { name: 'Retour au programme' }),
    ).toHaveAttribute('href', '/program/programme-test?stage=introduction');
    expect(screen.queryByText('Retour au module')).not.toBeInTheDocument();
  });

  it('restaure une tâche profonde et met sa progression à jour', async () => {
    window.history.replaceState(
      null,
      '',
      '/program/programme-test/lesson/demarrer?activity=task%3Atask-1',
    );
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer') {
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
      await screen.findByRole('heading', { name: 'Lire la référence' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: 'Validation de la leçon — 0 %',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Article de référence' }),
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Marquer comme terminé' }),
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
        path === '/api/lessons/demarrer'
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
