import { render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { TodayPage } from '@/pages/TodayPage';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

const primaryAction = {
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
};

function program(
  id: string,
  title: string,
  options: {
    percent: number;
    slug: string;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  },
) {
  const action =
    options.status === 'COMPLETED'
      ? null
      : {
          ...primaryAction,
          href: `/program/${options.slug}/lesson/prochaine`,
          programId: id,
          programSlug: options.slug,
          programTitle: title,
          title: `Prochaine activité de ${title}`,
        };
  return {
    id,
    lastActivity:
      options.status === 'IN_PROGRESS'
        ? {
            at: '2026-08-03T08:00:00.000Z',
            href: `/program/${options.slug}/lesson/precedente`,
            title: `Dernière activité de ${title}`,
          }
        : null,
    nextAction: action,
    percent: options.percent,
    resumeHref: action?.href ?? null,
    slug: options.slug,
    status: options.status,
    title,
  };
}

describe('TodayPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche un programme sans dupliquer la destination principale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: primaryAction,
            hasMorePrograms: false,
            lastActivity: null,
            program: {
              id: 'program-1',
              percent: 42,
              slug: 'psychologie',
              title: 'Psychologie',
            },
            programCount: 1,
            programs: [
              program('program-1', 'Psychologie', {
                percent: 42,
                slug: 'psychologie',
                status: 'IN_PROGRESS',
              }),
            ],
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
    expect(
      screen.getByRole('progressbar', { name: 'Progression' }),
    ).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('2 révisions à consolider')).toBeInTheDocument();
    expect(screen.getAllByText('Psychologie')).toHaveLength(1);
    const primaryActions = screen.getAllByRole('link', { name: 'Continuer' });
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveClass('ui-action--primary');
    const resumeCard = primaryActions[0]?.closest(
      '[data-totem-component="primary-resume"]',
    );
    expect(resumeCard).toHaveClass('ui-card--signature');
    expect(resumeCard).not.toHaveClass('ui-card--accent');
    expect(
      screen.queryByRole('heading', { name: 'Mes parcours en cours' }),
    ).not.toBeInTheDocument();
  });

  it('oriente une première arrivée avec un CTA unique sans faux compteur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: null,
            hasMorePrograms: false,
            lastActivity: null,
            program: null,
            programCount: 0,
            programs: [],
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
      await screen.findByRole('heading', {
        name: 'Votre premier parcours commence ici',
      }),
    ).toBeInTheDocument();
    const action = screen.getByRole('link', {
      name: 'Choisir mon premier parcours',
    });
    expect(action).toHaveAttribute(
      'href',
      '/program?view=discover&onboarding=1',
    );
    expect(action).toHaveClass('ui-action--primary');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('rend trois parcours identifiables et deux reprises compactes', async () => {
    const longTitle =
      'Ingénieur logiciel en production — construire et exploiter SourceLab avec une architecture durable';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: primaryAction,
            hasMorePrograms: false,
            lastActivity: null,
            program: {
              id: 'program-1',
              percent: 42,
              slug: 'psychologie',
              title: 'Psychologie',
            },
            programCount: 3,
            programs: [
              program('program-1', 'Psychologie', {
                percent: 42,
                slug: 'psychologie',
                status: 'IN_PROGRESS',
              }),
              program('program-2', longTitle, {
                percent: 12,
                slug: 'sourcelab',
                status: 'IN_PROGRESS',
              }),
              program('program-3', 'Officine Express', {
                percent: 0,
                slug: 'officine-express',
                status: 'NOT_STARTED',
              }),
            ],
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
      await screen.findByRole('heading', { name: 'Mes parcours en cours' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Psychologie')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: longTitle })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Officine Express' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: `Reprendre — ${longTitle}` }),
    ).toHaveAttribute('href', '/program/sourcelab/lesson/prochaine');
    expect(
      screen.getByRole('link', { name: 'Commencer — Officine Express' }),
    ).toHaveAttribute('href', '/program/officine-express/lesson/prochaine');
    expect(screen.getAllByText('Psychologie')).toHaveLength(1);
  });

  it('ne confond pas une erreur de chargement avec une première arrivée', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));

    render(
      <AppProviders>
        <TodayPage />
      </AppProviders>,
    );

    expect(
      await screen.findByText('Les recommandations n’ont pas pu être chargées.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Choisir mon premier parcours' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('traduit la hiérarchie multi-parcours en anglais sans traduire les contenus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            action: primaryAction,
            hasMorePrograms: false,
            lastActivity: null,
            program: {
              id: 'program-1',
              percent: 42,
              slug: 'psychologie',
              title: 'Psychologie',
            },
            programCount: 2,
            programs: [
              program('program-1', 'Psychologie', {
                percent: 42,
                slug: 'psychologie',
                status: 'IN_PROGRESS',
              }),
              program('program-2', 'Programme secondaire', {
                percent: 10,
                slug: 'secondaire',
                status: 'IN_PROGRESS',
              }),
            ],
            reviewsDue: 0,
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
    expect(
      screen.getByRole('heading', { name: 'My active learning paths' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lire le chapitre')).toBeInTheDocument();
  });
});
