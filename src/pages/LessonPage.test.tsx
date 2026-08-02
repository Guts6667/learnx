import { render, screen } from '@testing-library/preact';

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
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            lesson: {
              contentBlocks: [
                {
                  content: { text: 'Le contenu pédagogique.' },
                  id: 'block-1',
                  position: 1,
                  type: 'RICH_TEXT',
                },
              ],
              estimatedMinutes: 15,
              id: 'lesson-1',
              objectives: ['Comprendre la notion'],
              position: 1,
              prerequisites: [],
              resources: [
                {
                  author: 'Ada Lovelace',
                  citation: null,
                  description: 'Une lecture complémentaire.',
                  estimatedMinutes: 5,
                  id: 'resource-1',
                  isRequired: true,
                  position: 1,
                  title: 'Article de référence',
                  type: 'ARTICLE',
                  url: 'https://example.com/article',
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
        ),
      ),
    );

    render(
      <AppProviders>
        <LessonPage lessonSlug="demarrer" />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Démarrer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Comprendre la notion')).toBeInTheDocument();
    expect(screen.getByText('Le contenu pédagogique.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Consulter la ressource' }),
    ).toHaveAttribute('href', 'https://example.com/article');
    expect(screen.getByText('Synthétiser')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quiz indisponible' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Exercice indisponible' }),
    ).toBeDisabled();
  });
});
