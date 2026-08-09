import { render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { TodayPage } from '@/pages/TodayPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

describe('TodayPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche une seule action principale et le contexte quotidien', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: {
              estimatedMinutes: 20,
              href: '/program/psychologie/lesson/definition',
              kind: 'INCOMPLETE_TASK',
              lessonTitle: 'Définir la psychologie',
              moduleTitle: 'Introduction',
              programId: 'program-1',
              programSlug: 'psychologie',
              programTitle: 'Psychologie',
              stageTitle: 'Fondations',
              title: 'Lire le chapitre',
            },
            lastActivity: {
              at: '2026-08-03T08:00:00.000Z',
              href: '/program/psychologie/lesson/definition',
              title: 'Définir la psychologie',
            },
            program: {
              id: 'program-1',
              percent: 42,
              slug: 'psychologie',
              title: 'Psychologie',
            },
            reviewsDue: 2,
          }),
        ),
      ),
    );

    render(
      <AppProviders>
        <TodayPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Lire le chapitre' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Progression — 42 %')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Continuer' })).toHaveLength(1);
  });

  it('affiche un état vide sans programme actif', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: null,
            lastActivity: null,
            program: null,
            reviewsDue: 0,
          }),
        ),
      ),
    );

    render(
      <AppProviders>
        <TodayPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Aucun programme actif' }),
    ).toBeInTheDocument();
  });

  it('traduit l’écran authentifié complet en anglais sans traduire les contenus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: {
              estimatedMinutes: 20,
              href: '/program/psychologie/lesson/definition',
              kind: 'INCOMPLETE_TASK',
              lessonTitle: 'Définir la psychologie',
              moduleTitle: 'Introduction',
              programId: 'program-1',
              programSlug: 'psychologie',
              programTitle: 'Psychologie',
              stageTitle: 'Fondations',
              title: 'Lire le chapitre',
            },
            lastActivity: null,
            program: {
              id: 'program-1',
              percent: 42,
              slug: 'psychologie',
              title: 'Psychologie',
            },
            reviewsDue: 2,
          }),
        ),
      ),
    );

    render(
      <AppProviders locale="en">
        <TodayPage />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Today' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Task to continue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByText('Active program')).toBeInTheDocument();
    expect(screen.getByText('Lire le chapitre')).toBeInTheDocument();
  });
});
