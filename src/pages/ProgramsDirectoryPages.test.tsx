import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import {
  DiscoverProgramsPage,
  TotemProgramsPage,
} from '@/pages/ProgramsDirectoryPages';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

const enrolledProgram = {
  enrollment: {
    enrolledAt: '2026-08-24T10:00:00.000Z',
    id: 'enrollment-1',
    status: 'ACTIVE',
    updatedAt: '2026-08-24T10:00:00.000Z',
    withdrawnAt: null,
  },
  program: {
    canonicalProgramKey: 'sourcelab',
    description: 'Construire un socle local avec Docker et une API.',
    estimatedDurationDays: 4,
    icon: null,
    id: 'program-1',
    locale: 'fr',
    publishedVersion: {
      checksum: 'checksum',
      id: 'version-1',
      number: 1,
      publishedAt: '2026-08-24T10:00:00.000Z',
    },
    slug: 'sourcelab',
    title: 'SourceLab',
  },
  progress: {
    completedAt: null,
    lastViewedAt: '2026-08-24T10:00:00.000Z',
    percent: 38,
    startedAt: '2026-08-24T10:00:00.000Z',
    targetEndAt: null,
  },
};

describe('Totem program directories', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps followed programs separate from Discover', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ items: [enrolledProgram], nextCursor: null }),
        ),
      ),
    );

    render(
      <AppProviders>
        <TotemProgramsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'SourceLab' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Explorer les programmes' }),
    ).toHaveAttribute('href', '/discover');
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '38',
    );
  });

  it('searches the dedicated catalog and enrolls from that route', async () => {
    let enrolled = false;
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        enrolled = true;
        return Promise.resolve(jsonResponse({ enrollment: { id: 'new' } }));
      }
      return Promise.resolve(
        jsonResponse({
          items: [
            {
              canonicalProgramKey: 'sourcelab',
              description: 'Docker, API et ingestion.',
              estimatedDurationDays: 4,
              icon: null,
              id: 'program-1',
              isEnrolled: enrolled,
              locale: 'fr',
              publishedVersion: {
                checksum: 'checksum',
                id: 'version-1',
                number: 1,
                publishedAt: '2026-08-24T10:00:00.000Z',
              },
              slug: 'sourcelab',
              stageCount: 3,
              title: 'SourceLab',
            },
          ],
          nextCursor: null,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <DiscoverProgramsPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'SourceLab' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Ouvrir les filtres')).toBeInTheDocument();
    expect(screen.queryByText('Filtres')).not.toBeInTheDocument();
    fireEvent.input(screen.getByRole('searchbox'), {
      target: { value: 'docker' },
    });
    const searchForm = screen.getByRole('searchbox').closest('form');
    expect(searchForm).not.toBeNull();
    if (!searchForm) return;
    fireEvent.submit(searchForm);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) =>
          String(path).includes('search=docker'),
        ),
      ).toBe(true),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'S’inscrire' }));
    expect(
      await screen.findByText('SourceLab a été ajouté à Mes parcours.'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([path, init]) =>
          path === '/api/programs/program-1/enrollment' &&
          init?.method === 'POST',
      ),
    ).toBe(true);
  });
});
