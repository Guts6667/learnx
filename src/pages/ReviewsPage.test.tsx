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

function reviewsResponse() {
  return {
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
});
