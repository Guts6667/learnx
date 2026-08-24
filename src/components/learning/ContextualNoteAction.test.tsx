import { fireEvent, render, screen, waitFor } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { ContextualNoteAction } from '@/components/learning/ContextualNoteAction';
import type { NoteDetail } from '@/features/notes/queries';
import type { LessonActivity } from '@/lib/lesson-activity-sequence';

const creationKey = '9cc28351-e07b-4ee3-a59b-b3fe7be3eaa9';
const sequenceItemId = '71ef6280-158f-40d0-9269-14867c93cc6d';

const activity: LessonActivity = {
  estimatedMinutes: null,
  href: '/program/programme-test/lesson/demarrer?activity=content%3Ablock-1',
  id: 'block-1',
  kind: 'CONTENT',
  label: 'Comprendre',
  required: true,
  sequenceItemId,
  status: 'IN_PROGRESS',
  title: 'Définir la notion',
};

function noteResponse(
  input: Partial<Pick<NoteDetail, 'markdown' | 'title'>> = {},
): { note: NoteDetail } {
  return {
    note: {
      createdAt: '2026-08-09T00:00:00.000Z',
      id: '87b72c3a-0b2f-4dda-b82c-5874c91df9c8',
      lesson: { id: 'lesson-1', slug: 'demarrer', title: 'Démarrer' },
      markdown: input.markdown ?? '',
      program: {
        id: 'program-1',
        slug: 'programme-test',
        title: 'Programme test',
      },
      sequenceItem: {
        id: sequenceItemId,
        key: 'content-1',
        kind: 'CONTENT',
      },
      title: input.title ?? 'Notes — Démarrer',
      updatedAt: '2026-08-09T00:00:00.000Z',
    },
  };
}

function renderAction() {
  return render(
    <AppProviders>
      <ContextualNoteAction
        activity={activity}
        lesson={{ id: 'lesson-1', title: 'Démarrer' }}
      />
    </AppProviders>,
  );
}

describe('ContextualNoteAction', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(creationKey);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('crée une note liée, conserve la position et restaure le focus', async () => {
    const fetchMock = vi.fn(
      async (path: string, init?: RequestInit) => {
        void path;
        void init;
        return new Response(JSON.stringify(noteResponse()), {
          headers: { 'content-type': 'application/json' },
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAction();
    const trigger = screen.getByRole('button', { name: 'Prendre une note' });

    fireEvent.click(trigger);

    expect(
      await screen.findByRole('dialog', { name: 'Prendre une note' }),
    ).toHaveTextContent(
      'La note est automatiquement liée à la leçon « Démarrer » et à l’activité « Définir la notion ».',
    );
    expect(await screen.findByLabelText('Contenu de la note')).toBeVisible();
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe('/api/notes');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      creationKey,
      lessonId: 'lesson-1',
      sequenceItemId,
      title: 'Notes — Démarrer',
    });

    const closeButton = screen.getByRole('button', {
      name: 'Fermer le panneau',
    });
    fireEvent.click(closeButton);
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    expect(await screen.findByLabelText('Contenu de la note')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enregistre explicitement le titre et le Markdown', async () => {
    const fetchMock = vi.fn(
      async (_path: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify(
            noteResponse({ markdown: body.markdown, title: body.title }),
          ),
          { headers: { 'content-type': 'application/json' } },
        );
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAction();

    fireEvent.click(screen.getByRole('button', { name: 'Prendre une note' }));
    const title = await screen.findByLabelText('Titre');
    const markdown = screen.getByLabelText('Contenu de la note');
    fireEvent.input(title, { target: { value: 'Synthèse personnelle' } });
    fireEvent.input(markdown, { target: { value: 'Une idée importante.' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la note' }));

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('status')).toHaveTextContent(
          'Note enregistrée.',
        );
      },
      { timeout: 2_000 },
    );
    const saveRequest = fetchMock.mock.calls[1];
    expect(saveRequest?.[0]).toBe(
      '/api/notes/87b72c3a-0b2f-4dda-b82c-5874c91df9c8',
    );
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      markdown: 'Une idée importante.',
      title: 'Synthèse personnelle',
    });
    expect(
      screen.getByRole('button', { name: 'Voir la note' }),
    ).toBeVisible();
  });

  it('réessaie avec la même clé après une erreur de création', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(noteResponse()), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderAction();

    fireEvent.click(screen.getByRole('button', { name: 'Prendre une note' }));
    expect(
      await screen.findByText('La note n’a pas pu être créée.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByLabelText('Contenu de la note')).toBeVisible();
    const creationKeys = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)).creationKey,
    );
    expect(creationKeys).toEqual([creationKey, creationKey]);
  });
});
