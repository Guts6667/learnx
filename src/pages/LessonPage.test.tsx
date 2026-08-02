import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { LessonPage } from '@/pages/LessonPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

describe('LessonPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche le contenu, les ressources, les tâches et les évaluations', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/lessons/lesson-1/progress') {
        return Promise.resolve(
          jsonResponse({
            lessonProgress: {
              completedAt: null,
              percent: 0,
              startedAt: null,
              status: 'AVAILABLE',
            },
            resourceProgress: {},
            taskCompletions: {},
          }),
        );
      }

      return Promise.resolve(
        jsonResponse({
          lesson: {
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
            estimatedMinutes: 15,
            exercises: [],
            id: 'lesson-1',
            isPublished: false,
            objectives: ['Comprendre la notion'],
            position: 1,
            prerequisites: [],
            quizzes: [],
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
        }),
      );
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
    expect(screen.getByText('Comprendre la notion')).toBeInTheDocument();
    expect(screen.getByText('Le contenu pédagogique.')).toBeInTheDocument();
    expect(screen.getByText('Sources de ce bloc')).toBeInTheDocument();
    expect(screen.getAllByText('Article de référence')).toHaveLength(2);
    expect(screen.getAllByText(/Ada Lovelace/)).toHaveLength(2);
    expect(screen.getAllByText('Source non sûre')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Voir la source' }),
    ).toHaveAttribute('href', 'https://example.com/article');
    expect(
      await screen.findByRole('link', { name: 'Consulter la ressource' }),
    ).toHaveAttribute('href', 'https://example.com/article');
    expect(screen.getByText('Synthétiser')).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    expect(
      screen.getByText('Prévisualisation en lecture seule'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marquer comme terminée' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/lessons/lesson-1/progress',
      expect.anything(),
    );
    expect(
      screen.getByRole('button', { name: 'Quiz indisponible' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Exercice indisponible' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('link', {
        name: 'Prévisualiser et passer la mini-évaluation',
      }),
    ).toHaveAttribute(
      'href',
      '/program/programme-test/lesson/demarrer/assessment?assessmentId=assessment-1',
    );
  });

  it('met à jour une tâche avec la mutation de progression', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/lessons/demarrer?preview=true') {
        return Promise.resolve(
          jsonResponse({
            lesson: {
              concepts: [],
              contentBlocks: [],
              estimatedMinutes: null,
              exercises: [],
              id: 'lesson-1',
              isPublished: true,
              objectives: [],
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
              resources: [],
              slug: 'demarrer',
              summary: 'Les notions essentielles.',
              tasks: [
                {
                  description: null,
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
          }),
        );
      }

      if (path === '/api/lessons/lesson-1/progress') {
        return Promise.resolve(
          jsonResponse({
            lessonProgress: {
              completedAt: null,
              percent: 0,
              startedAt: null,
              status: 'AVAILABLE',
            },
            resourceProgress: {},
            taskCompletions: {},
          }),
        );
      }

      expect(init).toMatchObject({
        body: JSON.stringify({ status: 'DONE' }),
        method: 'PATCH',
      });
      return Promise.resolve(
        jsonResponse({
          lessonProgress: {
            completedAt: null,
            percent: 100,
            startedAt: '2026-08-02T00:00:00.000Z',
            status: 'IN_PROGRESS',
          },
          resourceProgress: {},
          taskCompletions: { 'task-1': 'DONE' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" programSlug="programme-test" />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Marquer comme terminée' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Marquer comme à faire' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(
      screen.getByRole('link', { name: 'Commencer le quiz' }),
    ).toHaveAttribute(
      'href',
      '/program/programme-test/lesson/demarrer/quiz?quizId=quiz-1',
    );
  });
});
