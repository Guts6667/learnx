import { act, fireEvent, render, screen } from '@testing-library/react';

import { AppProviders } from '@/app/providers';
import { NewNotePage, NotePage, NotesPage } from '@/pages/NotesPage';

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

    expect(await screen.findAllByText('Ma note')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Rechercher dans les notes' }),
    );
    fireEvent.input(screen.getByRole('searchbox'), {
      target: { value: 'attention' },
    });

    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes?search=attention',
      expect.anything(),
    );
    expect(
      (await screen.findAllByText('Attention sélective')).length,
    ).toBeGreaterThan(0);
  });

  it('ouvre un éditeur sans créer silencieusement de note', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ notes: [] })));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NotesPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nouvelle note' }),
    );

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('affiche un extrait texte sans marqueurs Markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            notes: [
              noteResponse({
                markdown:
                  '# Titre\n- Élément **important**\n[Documentation](https://example.com)',
              }).note,
            ],
          }),
        ),
      ),
    );

    render(
      <AppProviders>
        <NotesPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Titre Élément important Documentation'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/# Titre/)).not.toBeInTheDocument();
  });

  it('rend une erreur de liste récupérable sans perdre la page', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(() => {
      attempt += 1;
      return Promise.resolve(
        attempt === 1
          ? jsonResponse({ error: 'unavailable' }, 503)
          : jsonResponse({ notes: [noteResponse().note] }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NotesPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Les notes n’ont pas pu être chargées.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Ma note')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('NotePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('enregistre explicitement le titre et le Markdown', async () => {
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
      target: { value: 'Titre enregistré' },
    });
    fireEvent.input(screen.getByLabelText('Contenu de la note'), {
      target: { value: '# Nouveau contenu' },
    });
    expect(
      screen.getByText('Modifications non enregistrées.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/notes/${noteId}`,
      expect.objectContaining({ method: 'PATCH' }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer la note' }),
    );
    await act(() => Promise.resolve());

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${noteId}`,
      expect.objectContaining({
        body: JSON.stringify({
          markdown: '# Nouveau contenu',
          title: 'Titre enregistré',
        }),
        method: 'PATCH',
      }),
    );
    expect(await screen.findByText('Note enregistrée.')).toBeInTheDocument();
  });

  it('crée une note uniquement après la validation explicite', async () => {
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(noteResponse(), 201));
      }

      return Promise.resolve(jsonResponse({ notes: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NewNotePage />
      </AppProviders>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.input(screen.getByLabelText('Titre'), {
      target: { value: 'Nouvelle note' },
    });
    fireEvent.input(screen.getByLabelText('Contenu de la note'), {
      target: { value: 'Contenu explicite' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la note' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({
        body: JSON.stringify({
          markdown: 'Contenu explicite',
          title: 'Nouvelle note',
        }),
        method: 'POST',
      }),
    );
  });

  it('bascule au clavier vers un aperçu Markdown sûr', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            noteResponse({
              markdown:
                '# Titre valide\n\n###Test\n\n[Danger](javascript:alert(1))',
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

    const writeTab = await screen.findByRole('tab', { name: 'Écrire' });
    writeTab.focus();
    fireEvent.keyDown(writeTab, { key: 'ArrowRight' });

    const previewTab = screen.getByRole('tab', { name: 'Aperçu' });
    expect(previewTab).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByRole('heading', { name: 'Titre valide' }),
    ).toBeInTheDocument();
    expect(screen.getByText('###Test')).toBeInTheDocument();
    expect(screen.getByText('Danger')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Danger/ }),
    ).not.toBeInTheDocument();
    await act(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        ),
    );
    expect(previewTab).toHaveFocus();
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
      screen.getByRole('link', { name: 'Ouvrir la leçon' }),
    ).toHaveAttribute('href', '/program/programme-test/lesson/demarrer');
  });

  it('exige une confirmation avant de supprimer définitivement la note', async () => {
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(jsonResponse(noteResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <NotePage noteId={noteId} />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Supprimer la note' }),
    );

    const dialog = screen.getByRole('alertdialog', {
      name: 'Supprimer définitivement cette note ?',
    });
    expect(dialog).toHaveTextContent('Cette action est irréversible.');

    await act(
      () =>
        new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        ),
    );
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer la suppression' }),
    );

    await act(() => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${noteId}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
