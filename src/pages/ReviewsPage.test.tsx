import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { ReviewsPage } from '@/pages/ReviewsPage';

const reviewId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const assessmentId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function reviewsResponse(
  overrides: Record<string, unknown> = {},
  nextCursor: string | null = null,
) {
  return {
    nextCursor,
    reviews: [
      {
        assessmentTitle: 'Mini-évaluation — Mémoire',
        conceptTitle: 'Mémoire de travail',
        dueAt: '2026-08-02T08:00:00.000Z',
        id: reviewId,
        intervalDays: 1,
        isDraft: true,
        lesson: {
          id: 'lesson-1',
          slug: 'memoire',
          title: 'Comprendre la mémoire',
        },
        program: {
          id: 'program-1',
          slug: 'psychologie',
          title: 'Psychologie',
        },
        resources: [
          {
            id: 'resource-1',
            title: 'Chapitre sur la mémoire',
            url: 'https://example.com/memoire',
          },
          {
            id: 'resource-2',
            title: 'Lien non sûr',
            url: 'javascript:alert(1)',
          },
        ],
        sourceId: assessmentId,
        sourceType: 'CONCEPT_ASSESSMENT',
        status: 'PENDING',
        ...overrides,
      },
    ],
  };
}

describe('ReviewsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche les révisions, les ressources et le lien vers l’évaluation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(reviewsResponse()))),
    );

    render(
      <AppProviders>
        <ReviewsPage />
      </AppProviders>,
    );

    expect(await screen.findByText('Mémoire de travail')).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Refaire l’évaluation' }),
    ).toHaveAttribute(
      'href',
      `/program/psychologie/lesson/memoire/assessment?assessmentId=${assessmentId}`,
    );
    expect(
      screen.getByRole('link', { name: 'Chapitre sur la mémoire' }),
    ).toHaveAttribute('href', 'https://example.com/memoire');
    expect(screen.getByText('Lien non sûr')).not.toHaveAttribute('href');
  });

  it('marque manuellement une révision comme terminée', async () => {
    let completed = false;
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        completed = true;
        return Promise.resolve(
          jsonResponse({
            review: {
              completedAt: '2026-08-03T10:00:00.000Z',
              id: reviewId,
              status: 'COMPLETED',
            },
          }),
        );
      }

      return Promise.resolve(
        jsonResponse(completed ? { reviews: [] } : reviewsResponse()),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ReviewsPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Marquer comme terminée' }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reviews/${reviewId}`,
      expect.objectContaining({
        body: JSON.stringify({ status: 'completed' }),
        method: 'PATCH',
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Aucune révision en attente'),
      ).toBeInTheDocument(),
    );
  });

  it('affiche un état vide sans révision', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ reviews: [] }))),
    );

    render(
      <AppProviders>
        <ReviewsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Aucune révision en attente'),
    ).toBeInTheDocument();
  });

  it('rend une erreur récupérable par une relance explicite', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(() => {
      attempt += 1;
      return Promise.resolve(
        attempt === 1
          ? jsonResponse({ error: 'unavailable' }, 503)
          : jsonResponse(reviewsResponse()),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ReviewsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Les révisions n’ont pas pu être chargées.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Mémoire de travail')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('conserve les révisions chargées et reprend une page suivante en erreur', async () => {
    let pageAttempt = 0;
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/reviews?cursor=page-2') {
        pageAttempt += 1;
        return Promise.resolve(
          pageAttempt === 1
            ? jsonResponse({ error: 'unavailable' }, 503)
            : jsonResponse(
                reviewsResponse({
                  conceptTitle: 'Mémoire à long terme',
                  id: '2dd116ff-8dfa-4734-b4d3-3119461f17ad',
                }),
              ),
        );
      }

      return Promise.resolve(jsonResponse(reviewsResponse({}, 'page-2')));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <ReviewsPage />
      </AppProviders>,
    );

    expect(await screen.findByText('Mémoire de travail')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(
      await screen.findByText(
        'Les révisions suivantes n’ont pas pu être chargées.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Mémoire de travail')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Afficher plus' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Mémoire à long terme')).toBeInTheDocument();
    await waitFor(() => expect(pageAttempt).toBe(2));
  });
});
