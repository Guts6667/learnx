import { act, fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { NotePage, NotesPage } from '@/pages/NotesPage';

const noteId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function noteResponse(overrides: Record<string, unknown> = {}) {
  return {
    note: {
      createdAt: '2026-08-03T08:00:00.000Z',
      id: noteId,
      lesson: null,
      markdown: 'Contenu initial',
      program: null,
      title: 'Ma note',
      updatedAt: '2026-08-03T08:00:00.000Z',
      ...overrides,
    },
  };
}

describe('NotesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('affiche les notes et recherche dans leur contenu', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/notes?search=attention') {
        return Promise.resolve(
          jsonResponse({
            notes: [noteResponse({ markdown: 'Attention sélective' }).note],
          }),
        );
      }

      return Promise.resolve(jsonResponse({ notes: [noteResponse().note] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NotesPage />
      </AppProviders>,
    );

    expect(await screen.findByText('Ma note')).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText('Rechercher dans les notes'), {
      target: { value: 'attention' },
    });

    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes?search=attention',
      expect.anything(),
    );
    expect(await screen.findByText('Attention sélective')).toBeInTheDocument();
  });

  it('crée une note personnelle depuis la liste', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/notes' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(noteResponse(), 201));
      }

      return Promise.resolve(jsonResponse({ notes: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NotesPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nouvelle note' }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({ body: '{}', method: 'POST' }),
    );
  });
});

describe('NotePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('autosauvegarde le titre et le Markdown après temporisation', async () => {
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as {
          markdown: string;
          title: string;
        };
        return Promise.resolve(
          jsonResponse(
            noteResponse({ ...body, updatedAt: '2026-08-03T09:00:00.000Z' }),
          ),
        );
      }

      return Promise.resolve(jsonResponse(noteResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NotePage noteId={noteId} />
      </AppProviders>,
    );

    fireEvent.input(await screen.findByLabelText('Titre'), {
      target: { value: 'Titre autosauvegardé' },
    });
    fireEvent.input(screen.getByLabelText('Contenu de la note'), {
      target: { value: '# Nouveau contenu' },
    });
    expect(screen.getByText('Modifications en attente…')).toBeInTheDocument();

    await act(() => new Promise((resolve) => window.setTimeout(resolve, 750)));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${noteId}`,
      expect.objectContaining({
        body: JSON.stringify({
          markdown: '# Nouveau contenu',
          title: 'Titre autosauvegardé',
        }),
        method: 'PATCH',
      }),
    );
    expect(
      await screen.findByText('Toutes les modifications sont enregistrées.'),
    ).toBeInTheDocument();
  });

  it('affiche le contexte d’une note liée sans rendre le Markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            noteResponse({
              lesson: { id: 'lesson-1', slug: 'demarrer', title: 'Démarrer' },
              markdown: '<script>alert(1)</script>',
              program: {
                id: 'program-1',
                slug: 'programme-test',
                title: 'Programme test',
              },
            }),
          ),
        ),
      ),
    );

    render(
      <AppProviders>
        <NotePage noteId={noteId} />
      </AppProviders>,
    );

    expect(await screen.findByText('Démarrer')).toBeInTheDocument();
    expect(screen.getByLabelText('Contenu de la note')).toHaveValue(
      '<script>alert(1)</script>',
    );
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Retour à la leçon' }),
    ).toHaveAttribute('href', '/program/programme-test/lesson/demarrer');
  });
});
