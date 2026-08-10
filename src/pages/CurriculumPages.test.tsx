import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';

import { AppProviders } from '@/app/providers';
import {
  ModulePage,
  ProgramPage,
  ProgramsPage,
  StagePage,
} from '@/pages/CurriculumPages';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function renderPage(page: ComponentChildren) {
  return render(<AppProviders>{page}</AppProviders>);
}

describe('CurriculumPages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche Mes programmes par défaut et permet d’explorer au clavier', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (path === '/api/programs?preview=true') {
          return Promise.resolve(
            jsonResponse({
              programs: [
                {
                  canonicalProgramKey: 'platform-apm',
                  description: 'Préparer un entretien produit.',
                  estimatedDurationDays: 2,
                  id: 'program-owned',
                  locale: 'fr',
                  slug: 'platform-apm',
                  stages: [
                    {
                      id: 'stage-owned',
                      isPublished: false,
                      position: 1,
                      slug: 'preparation',
                      title: 'Préparation',
                    },
                  ],
                  status: 'ACTIVE',
                  timeline: {
                    actualPercent: 0,
                    completedAt: null,
                    expectedPercent: 0,
                    progressDelta: 0,
                    startedAt: null,
                    targetEndAt: null,
                    temporalStatus: null,
                  },
                  title: 'Platform APM',
                  visibility: 'PRIVATE',
                },
              ],
            }),
          );
        }
        if (path.startsWith('/api/catalog/programs?')) {
          return Promise.resolve(
            jsonResponse({
              items: [
                {
                  canonicalProgramKey: 'approfondir',
                  description: 'Approfondir les bases.',
                  estimatedDurationDays: 12,
                  icon: null,
                  id: 'program-2',
                  isEnrolled: false,
                  locale: 'fr',
                  publishedVersion: {
                    checksum: 'catalog-checksum',
                    id: 'version-2',
                    number: 2,
                    publishedAt: '2026-08-05T10:00:00.000Z',
                  },
                  slug: 'approfondir',
                  stageCount: 3,
                  title: 'Approfondir',
                },
              ],
              nextCursor: null,
            }),
          );
        }
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                enrollment: {
                  enrolledAt: '2026-08-05T10:00:00.000Z',
                  id: 'enrollment-1',
                  status: 'ACTIVE',
                  updatedAt: '2026-08-05T10:00:00.000Z',
                  withdrawnAt: null,
                },
                program: {
                  canonicalProgramKey: 'bases',
                  description: 'Découvrir les bases.',
                  estimatedDurationDays: 10,
                  icon: null,
                  id: 'program-1',
                  locale: 'fr',
                  publishedVersion: {
                    checksum: 'checksum',
                    id: 'version-1',
                    number: 1,
                    publishedAt: '2026-08-05T10:00:00.000Z',
                  },
                  slug: 'bases',
                  title: 'Les bases',
                },
                progress: {
                  completedAt: null,
                  lastViewedAt: '2026-08-05T10:00:00.000Z',
                  percent: 35,
                  startedAt: '2026-08-05T10:00:00.000Z',
                  targetEndAt: null,
                },
              },
            ],
            nextCursor: null,
          }),
        );
      }),
    );

    renderPage(<ProgramsPage />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Les bases' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Platform APM' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Propriétaire')).toBeInTheDocument();
    expect(screen.getByText('Privé')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Prévisualiser le programme' }),
    ).toHaveAttribute('href', '/program/platform-apm');
    expect(
      screen.getByRole('progressbar', { name: 'Progression — 35 %' }),
    ).toHaveAttribute('aria-valuenow', '35');
    expect(screen.getByRole('link', { name: 'Continuer' })).toHaveAttribute(
      'href',
      '/program/bases',
    );
    const enrolledTab = screen.getByRole('tab', { name: 'Mes programmes' });
    const catalogTab = screen.getByRole('tab', { name: 'Explorer' });
    expect(enrolledTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(enrolledTab, { key: 'ArrowRight' });
    expect(catalogTab).toHaveAttribute('aria-selected', 'true');
    expect(catalogTab).toHaveFocus();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Approfondir' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Français').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Langue du programme'), {
      target: { value: 'en' },
    });
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([path]) =>
          String(path).includes('locale=en'),
        ),
      ).toBe(true),
    );
    expect(
      await screen.findByRole('button', { name: 'S’inscrire' }),
    ).toBeEnabled();
  });

  it('confirme l’inscription côté serveur avant de mettre à jour le catalogue', async () => {
    let isEnrolled = false;
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/programs?preview=true') {
        return Promise.resolve(jsonResponse({ programs: [] }));
      }
      if (init?.method === 'POST') {
        isEnrolled = true;
        return Promise.resolve(jsonResponse({ enrollment: { id: 'new' } }));
      }
      if (path.startsWith('/api/catalog/programs?')) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                canonicalProgramKey: 'programme-public',
                description: 'Un programme public.',
                estimatedDurationDays: 8,
                icon: null,
                id: 'program-public',
                isEnrolled,
                locale: 'fr',
                publishedVersion: {
                  checksum: 'checksum',
                  id: 'version-public',
                  number: 1,
                  publishedAt: '2026-08-05T10:00:00.000Z',
                },
                slug: 'programme-public',
                stageCount: 2,
                title: 'Programme public',
              },
            ],
            nextCursor: null,
          }),
        );
      }
      return Promise.resolve(jsonResponse({ items: [], nextCursor: null }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(<ProgramsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));
    const enrollButton = await screen.findByRole('button', {
      name: 'S’inscrire',
    });
    fireEvent.click(enrollButton);

    expect(
      await screen.findByText(
        'Programme public a été ajouté à Mes programmes.',
      ),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([path, init]) =>
          path === '/api/programs/program-public/enrollment' &&
          init?.method === 'POST',
      ),
    ).toBe(true);
    expect(
      await screen.findByRole('link', { name: 'Ouvrir le programme' }),
    ).toHaveAttribute('href', '/program/programme-public');
  });

  it('normalise la recherche et charge la page suivante sans doublon', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/programs?preview=true') {
        return Promise.resolve(jsonResponse({ programs: [] }));
      }
      if (path.startsWith('/api/me/programs?')) {
        return Promise.resolve(jsonResponse({ items: [], nextCursor: null }));
      }
      const isNextPage = path.includes('cursor=next-page');
      return Promise.resolve(
        jsonResponse({
          items: [
            {
              canonicalProgramKey: isNextPage ? 'second' : 'premier',
              description: isNextPage ? 'Seconde page.' : 'Première page.',
              estimatedDurationDays: 5,
              icon: null,
              id: isNextPage ? 'program-2' : 'program-1',
              isEnrolled: false,
              locale: 'fr',
              publishedVersion: {
                checksum: 'checksum',
                id: 'version',
                number: 1,
                publishedAt: '2026-08-05T10:00:00.000Z',
              },
              slug: isNextPage ? 'second' : 'premier',
              stageCount: 1,
              title: isNextPage ? 'Second programme' : 'Premier programme',
            },
          ],
          nextCursor: isNextPage ? null : 'next-page',
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(<ProgramsPage />);
    fireEvent.input(screen.getByLabelText('Rechercher un programme'), {
      target: { value: '  sciences   humaines  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Explorer' }));

    expect(
      await screen.findByRole('heading', { name: 'Premier programme' }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([path]) =>
        path.includes('search=sciences+humaines'),
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(
      await screen.findByRole('heading', { name: 'Second programme' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Premier programme' }),
    ).toBeInTheDocument();
  });

  it('demande confirmation avant la désinscription et conserve un retour explicite', async () => {
    let isActive = true;
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/programs?preview=true') {
        return Promise.resolve(jsonResponse({ programs: [] }));
      }
      if (init?.method === 'DELETE') {
        isActive = false;
        return Promise.resolve(
          jsonResponse({ enrollment: { id: 'enrollment' } }),
        );
      }
      if (path.startsWith('/api/me/programs?')) {
        return Promise.resolve(
          jsonResponse({
            items: isActive
              ? [
                  {
                    enrollment: {
                      enrolledAt: '2026-08-05T10:00:00.000Z',
                      id: 'enrollment',
                      status: 'ACTIVE',
                      updatedAt: '2026-08-05T10:00:00.000Z',
                      withdrawnAt: null,
                    },
                    program: {
                      canonicalProgramKey: 'programme-actif',
                      description: 'Programme à quitter.',
                      estimatedDurationDays: null,
                      icon: null,
                      id: 'program-active',
                      locale: 'fr',
                      publishedVersion: {
                        checksum: 'checksum',
                        id: 'version',
                        number: 1,
                        publishedAt: '2026-08-05T10:00:00.000Z',
                      },
                      slug: 'programme-actif',
                      title: 'Programme actif',
                    },
                    progress: null,
                  },
                ]
              : [],
            nextCursor: null,
          }),
        );
      }
      return Promise.resolve(jsonResponse({ items: [], nextCursor: null }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(<ProgramsPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Se désinscrire' }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/programs/program-active/enrollment',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(
      screen.getByText(/Vos notes, votre progression et vos tentatives/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer la désinscription' }),
    );

    expect(
      await screen.findByText('Vous êtes désinscrit de Programme actif.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Aucun programme suivi' }),
    ).toBeInTheDocument();
  });

  it('affiche un état hors ligne sans lancer de requête privée', () => {
    const onlineSpy = vi
      .spyOn(navigator, 'onLine', 'get')
      .mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderPage(<ProgramsPage />);

    expect(
      screen.getByRole('heading', {
        name: 'Programmes indisponibles hors ligne',
      }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    onlineSpy.mockRestore();
  });

  it('préfère la prévisualisation propriétaire puis replie vers la lecture normale', async () => {
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/programs/public?preview=true') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'RESOURCE_NOT_FOUND',
                message: 'Resource not found.',
              },
            }),
            {
              headers: { 'content-type': 'application/json' },
              status: 404,
            },
          ),
        );
      }
      return Promise.resolve(
        jsonResponse({
          program: {
            description: 'Programme accessible.',
            id: 'program',
            slug: path.includes('brouillon') ? 'brouillon' : 'public',
            stages: [],
            status: path.includes('brouillon') ? 'DRAFT' : 'ACTIVE',
            timeline: {
              actualPercent: 0,
              completedAt: null,
              expectedPercent: 0,
              progressDelta: 0,
              startedAt: null,
              targetEndAt: null,
              temporalStatus: null,
            },
            title: path.includes('brouillon')
              ? 'Programme brouillon'
              : 'Programme public',
            visibility: path.includes('brouillon') ? 'PRIVATE' : 'PUBLIC',
            viewPreference: { expandedStageId: null },
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage(<ProgramPage programSlug="brouillon" />);

    expect(
      await screen.findByRole('heading', { name: 'Programme brouillon' }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/programs/brouillon?preview=true',
    ]);

    renderPage(<ProgramPage programSlug="public" />);

    expect(
      await screen.findByRole('heading', { name: 'Programme public' }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([path]) => path)).toContain(
      '/api/programs/public',
    );
  });

  it('n’ouvre qu’une étape et mémorise le choix sans naviguer', async () => {
    const timeline = {
      actualPercent: 0,
      completedAt: null,
      expectedPercent: 0,
      progressDelta: 0,
      startedAt: null,
      targetEndAt: null,
      temporalStatus: null,
    };
    const createStage = (id: string, position: number, title: string) => ({
      description: `Résumé ${title}`,
      estimatedDurationDays: position,
      estimatedMinutes: null,
      id,
      isPublished: true,
      modules: [
        {
          id: `module-${position}`,
          isPublished: true,
          lessons: [],
          position: 1,
          progress: { percent: 0, status: 'AVAILABLE' },
          slug: `module-${position}`,
          title: `Module ${position}`,
        },
      ],
      position,
      progress: { percent: 0, status: 'AVAILABLE' },
      slug: `etape-${position}`,
      timeline,
      title,
    });
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve(
          jsonResponse({ viewPreference: { expandedStageId: 'stage-1' } }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          program: {
            description: 'Un parcours compact.',
            id: 'program-1',
            slug: 'compact',
            stages: [
              createStage('stage-1', 1, 'Étape une'),
              createStage('stage-2', 2, 'Étape deux'),
            ],
            status: 'ACTIVE',
            timeline,
            title: 'Programme compact',
            viewPreference: { expandedStageId: 'stage-2' },
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = renderPage(<ProgramPage programSlug="compact" />);

    const firstStage = await screen.findByRole('button', {
      name: /Étape une/,
    });
    const secondStage = screen.getByRole('button', { name: /Étape deux/ });
    expect(firstStage).toHaveAttribute('aria-expanded', 'false');
    expect(secondStage).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Résumé Étape une')).toBeNull();
    expect(screen.queryByText('Résumé Étape deux')).toBeNull();

    fireEvent.click(secondStage);

    expect(screen.getByRole('button', { name: /Étape une/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /Étape deux/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT'),
    ).toHaveLength(0);

    view.unmount();
    renderPage(<ProgramPage programSlug="compact" />);

    const restoredFirstStage = await screen.findByRole('button', {
      name: /Étape une/,
    });
    expect(screen.getByRole('button', { name: /Étape deux/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    fireEvent.click(restoredFirstStage);

    expect(screen.getByRole('button', { name: /Étape une/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Étape deux/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Résumé Étape une')).toBeNull();
    expect(screen.queryByText('Résumé Étape deux')).toBeNull();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/programs/compact/view-preference',
        expect.objectContaining({
          body: JSON.stringify({ expandedStageId: 'stage-1' }),
          method: 'PUT',
        }),
      ),
    );
  });

  it('ouvre la bonne étape depuis une URL déterministe après rechargement', async () => {
    window.history.replaceState({}, '', '/program/compact?stage=etape-1');
    const timeline = {
      actualPercent: 0,
      completedAt: null,
      expectedPercent: 0,
      progressDelta: 0,
      startedAt: null,
      targetEndAt: null,
      temporalStatus: null,
    };
    const stage = (id: string, slug: string, position: number) => ({
      description: `Étape ${position}`,
      estimatedDurationDays: position,
      estimatedMinutes: null,
      id,
      isPublished: true,
      modules: [],
      position,
      progress: { percent: 0, status: 'AVAILABLE' },
      slug,
      timeline,
      title: `Étape ${position}`,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            program: {
              description: 'Programme direct.',
              id: 'program-direct',
              slug: 'compact',
              stages: [
                stage('stage-1', 'etape-1', 1),
                stage('stage-2', 'etape-2', 2),
              ],
              status: 'ACTIVE',
              timeline,
              title: 'Programme direct',
              viewPreference: { expandedStageId: 'stage-2' },
            },
          }),
        ),
      ),
    );

    renderPage(<ProgramPage programSlug="compact" />);

    expect(
      await screen.findByRole('button', { name: /1\. Étape 1/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /2\. Étape 2/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    window.history.replaceState({}, '', '/');
  });

  it('affiche les leçons en lignes plates avec leurs quatre états', async () => {
    const timeline = {
      actualPercent: 40,
      completedAt: null,
      expectedPercent: 35,
      progressDelta: 5,
      startedAt: '2026-08-08T08:00:00.000Z',
      targetEndAt: null,
      temporalStatus: 'ahead',
    };
    const lesson = (
      id: string,
      title: string,
      status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS',
      isLocked = false,
    ) => ({
      activityCounts: {
        concepts: 0,
        exercises: 0,
        quizzes: 0,
        resources: 0,
        tasks: 0,
      },
      estimatedMinutes: 20,
      id,
      isLocked,
      isPublished: true,
      position: 1,
      progress: { percent: status === 'COMPLETED' ? 100 : 0, status },
      slug: id,
      summary: `Résumé ${title}`,
      title,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            program: {
              description: 'Programme à parcourir.',
              id: 'program-flat',
              slug: 'programme-plat',
              stages: [
                {
                  description: 'Étape ouverte.',
                  estimatedDurationDays: 3,
                  estimatedMinutes: null,
                  id: 'stage-flat',
                  isPublished: true,
                  modules: [
                    {
                      id: 'module-a',
                      isPublished: true,
                      lessons: [
                        lesson('disponible', 'Leçon disponible', 'AVAILABLE'),
                        lesson('encours', 'Leçon en cours', 'IN_PROGRESS'),
                      ],
                      position: 1,
                      progress: { percent: 20, status: 'IN_PROGRESS' },
                      slug: 'module-a',
                      title: 'Module A',
                    },
                    {
                      id: 'module-b',
                      isPublished: true,
                      lessons: [
                        lesson('terminee', 'Leçon terminée', 'COMPLETED'),
                        lesson(
                          'verrouillee',
                          'Leçon verrouillée',
                          'AVAILABLE',
                          true,
                        ),
                      ],
                      position: 2,
                      progress: { percent: 50, status: 'IN_PROGRESS' },
                      slug: 'module-b',
                      title: 'Module B',
                    },
                  ],
                  position: 1,
                  progress: { percent: 40, status: 'IN_PROGRESS' },
                  slug: 'etape-plate',
                  timeline,
                  title: 'Étape plate',
                },
              ],
              status: 'ACTIVE',
              timeline,
              title: 'Programme plat',
              viewPreference: { expandedStageId: 'stage-flat' },
            },
          }),
        ),
      ),
    );

    const view = renderPage(<ProgramPage programSlug="programme-plat" />);

    expect(
      await screen.findByRole('button', { name: /1\. Étape plate/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Module A' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Module B' })).toBeVisible();
    expect(
      screen.getAllByRole('link', { name: 'Options et reprise du module' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: /Ouvrir Leçon disponible.*Module A/ }),
    ).toHaveAttribute('href', '/program/programme-plat/lesson/disponible');
    expect(
      screen.getByRole('link', { name: /Reprendre Leçon en cours.*Module A/ }),
    ).toHaveAttribute('href', '/program/programme-plat/lesson/encours');
    expect(
      screen.getByRole('link', { name: /Revoir Leçon terminée.*Module B/ }),
    ).toHaveAttribute('href', '/program/programme-plat/lesson/terminee');
    expect(
      screen.getByLabelText(/Leçon verrouillée, module Module B, Verrouillée/),
    ).not.toHaveAttribute('href');
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.queryByText(/Progression de l’étape/)).toBeNull();
    expect(screen.queryByText(/Progression du module/)).toBeNull();
    expect(view.container.querySelector('.ui-card .ui-card')).toBeNull();
  });

  it('relie le programme, l’étape et le module à leurs contenus', async () => {
    const lesson = {
      activityCounts: {
        concepts: 1,
        exercises: 1,
        quizzes: 1,
        resources: 2,
        tasks: 1,
      },
      estimatedMinutes: 10,
      id: 'lesson-1',
      isPublished: false,
      position: 1,
      progress: { percent: 25, status: 'IN_PROGRESS' },
      slug: 'demarrer',
      summary: 'Les notions essentielles.',
      title: 'Démarrer',
    };
    const module = {
      id: 'module-1',
      isPublished: false,
      lessons: [lesson],
      position: 1,
      progress: { percent: 25, status: 'IN_PROGRESS' },
      slug: 'premiers-pas',
      title: 'Premiers pas',
    };
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/programs/bases?preview=true') {
        return Promise.resolve(
          jsonResponse({
            program: {
              description: 'Découvrir les bases.',
              id: 'program-1',
              slug: 'bases',
              stages: [
                {
                  description: 'Comprendre les premiers repères.',
                  estimatedDurationDays: 4,
                  estimatedMinutes: null,
                  id: 'stage-1',
                  isPublished: false,
                  modules: [module],
                  position: 1,
                  progress: { percent: 25, status: 'IN_PROGRESS' },
                  slug: 'introduction',
                  timeline: null,
                  title: 'Introduction',
                },
              ],
              status: 'ACTIVE',
              timeline: {
                actualPercent: 25,
                completedAt: null,
                expectedPercent: 20,
                progressDelta: 5,
                startedAt: null,
                targetEndAt: null,
                temporalStatus: 'ahead',
              },
              title: 'Les bases',
              visibility: 'PRIVATE',
              viewPreference: { expandedStageId: 'stage-1' },
            },
          }),
        );
      }

      if (path === '/api/programs/bases/stages/introduction') {
        return Promise.resolve(
          jsonResponse({
            stage: {
              estimatedDurationDays: null,
              estimatedMinutes: null,
              description: 'Comprendre les premiers repères.',
              id: 'stage-1',
              isPublished: false,
              modules: [
                {
                  id: 'module-1',
                  isPublished: false,
                  lessons: [lesson],
                  position: 1,
                  progress: { percent: 25, status: 'IN_PROGRESS' },
                  slug: 'premiers-pas',
                  title: 'Premiers pas',
                },
              ],
              position: 1,
              progress: { percent: 25, status: 'IN_PROGRESS' },
              slug: 'introduction',
              title: 'Introduction',
              validation: {
                finalAssessments: { total: 1, validated: 0 },
                isValidated: false,
                missingRequirements: [
                  {
                    id: 'assessment-1',
                    title: 'Analyser une situation',
                    type: 'FINAL_ASSESSMENT',
                  },
                ],
                requiredConcepts: { total: 2, validated: 1 },
                requiredTasks: { total: 1, validated: 0 },
                status: 'AVAILABLE',
              },
            },
          }),
        );
      }

      if (path === '/api/stages/stage-1/assessment?preview=true') {
        return Promise.resolve(
          jsonResponse({
            assessment: {
              description: null,
              id: 'assessment-1',
              instructions: null,
              isRequired: true,
              passingScore: 70,
              position: 1,
              rubric: null,
              stageId: 'stage-1',
              submission: null,
              title: 'Analyser une situation',
              type: 'CASE_STUDY',
            },
          }),
        );
      }

      return Promise.resolve(
        jsonResponse({
          module: {
            description: 'La première leçon.',
            estimatedMinutes: 20,
            id: 'module-1',
            isPublished: false,
            lessons: [lesson],
            position: 1,
            slug: 'premiers-pas',
            stage: {
              id: 'stage-1',
              isPublished: false,
              program: { id: 'program-1', slug: 'bases', title: 'Les bases' },
              slug: 'introduction',
              title: 'Introduction',
            },
            title: 'Premiers pas',
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const programView = renderPage(<ProgramPage programSlug="bases" />);
    expect(
      await screen.findByRole('button', { name: /Introduction/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Comprendre les premiers repères.')).toBeNull();
    expect(screen.queryByText('Les notions essentielles.')).toBeNull();
    expect(screen.queryByText(/6 activités/)).toBeNull();
    expect(
      screen.getByRole('link', {
        name: /Reprendre Démarrer, module Premiers pas, Brouillon/,
      }),
    ).toHaveAttribute('href', '/program/bases/lesson/demarrer');
    expect(
      screen.getByRole('link', { name: 'Options et reprise du module' }),
    ).toHaveAttribute('href', '/program/bases/module/premiers-pas');
    expect(
      screen.getByRole('link', { name: 'Voir les prérequis de l’étape' }),
    ).toHaveAttribute('href', '/program/bases/stage/introduction');
    expect(
      screen.getByRole('progressbar', {
        name: 'Progression du programme — 25 %',
      }),
    ).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getAllByText('Brouillon')).not.toHaveLength(0);

    programView.unmount();
    const stageView = renderPage(
      <StagePage programSlug="bases" stageSlug="introduction" />,
    );
    expect(
      await screen.findByRole('link', { name: 'Ouvrir le module' }),
    ).toHaveAttribute('href', '/program/bases/module/premiers-pas');
    expect(screen.getAllByText('Brouillon')).not.toHaveLength(0);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Évaluation finale',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Type : Étude de cas')).toBeInTheDocument();
    expect(
      screen.getByText(/Prévisualisation en lecture seule/),
    ).toBeInTheDocument();
    expect(screen.getByText('Prérequis manquants')).toBeInTheDocument();
    expect(screen.getByText('Notions obligatoires : 1/2')).toBeInTheDocument();

    stageView.unmount();
    renderPage(<ModulePage moduleSlug="premiers-pas" programSlug="bases" />);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Démarrer' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Brouillon')).not.toHaveLength(0);
  });

  it('détaille et confirme la reprise d’un module publié', async () => {
    const moduleId = '22222222-2222-4222-8222-222222222222';
    const lesson = {
      activityCounts: {
        concepts: 1,
        exercises: 1,
        quizzes: 1,
        resources: 1,
        tasks: 1,
      },
      estimatedMinutes: 10,
      id: 'lesson-1',
      isLocked: false,
      isPublished: true,
      position: 1,
      progress: { percent: 75, status: 'IN_PROGRESS' },
      slug: 'demarrer',
      summary: 'Les notions essentielles.',
      title: 'Démarrer',
    };
    const preview = {
      currentRunSequence: 1,
      firstLesson: { slug: lesson.slug, title: lesson.title },
      moduleId,
      moduleTitle: 'Premiers pas',
      preserved: {
        conceptAttempts: 4,
        exerciseSubmissions: 2,
        notes: 3,
        quizAttempts: 5,
      },
      reset: {
        concepts: 3,
        exercises: 1,
        lessons: 2,
        quizzes: 1,
        resources: 4,
        tasks: 3,
      },
    };
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/modules/premiers-pas') {
        return Promise.resolve(
          jsonResponse({
            module: {
              description: 'La première leçon.',
              estimatedMinutes: 20,
              id: moduleId,
              isPublished: true,
              lessons: [lesson],
              position: 1,
              slug: 'premiers-pas',
              stage: {
                id: 'stage-1',
                isPublished: true,
                program: { id: 'program-1', slug: 'bases', title: 'Les bases' },
                slug: 'introduction',
                title: 'Introduction',
              },
              title: 'Premiers pas',
            },
          }),
        );
      }
      if (path === `/api/modules/${moduleId}/restart-preview`) {
        return Promise.resolve(jsonResponse({ preview }));
      }
      if (
        path === `/api/modules/${moduleId}/restart` &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(
          jsonResponse({
            result: {
              ...preview,
              currentRunSequence: 2,
              idempotent: false,
              runId: 'run-2',
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      randomUUID: () => '33333333-3333-4333-8333-333333333333',
    });

    renderPage(<ModulePage moduleSlug="premiers-pas" programSlug="bases" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Recommencer ce module' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Confirmer la reprise du module',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 leçons, 3 tâches, 4 ressources/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 notes, 5 tentatives de quiz/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Oui, recommencer ce module' }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/modules/${moduleId}/restart`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});

describe('program restart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('confirme la reprise, annonce les données conservées et relance le programme', async () => {
    const programId = '55555555-5555-4555-8555-555555555555';
    const lesson = {
      activityCounts: {
        concepts: 1,
        exercises: 1,
        quizzes: 1,
        resources: 1,
        tasks: 1,
      },
      estimatedMinutes: 15,
      id: 'lesson-1',
      isLocked: false,
      isPublished: true,
      position: 1,
      progress: { percent: 75, status: 'IN_PROGRESS' },
      slug: 'premiere-lecon',
      summary: 'Commencer le programme.',
      title: 'Première leçon',
    };
    const preview = {
      firstLesson: { slug: lesson.slug, title: lesson.title },
      programId,
      programTitle: 'Programme test',
      preserved: {
        conceptAttempts: 4,
        exerciseSubmissions: 2,
        notes: 3,
        quizAttempts: 5,
        stageAssessmentSubmissions: 1,
      },
      reset: {
        concepts: 3,
        exercises: 2,
        lessons: 2,
        modules: 1,
        quizzes: 1,
        resources: 4,
        stages: 1,
        tasks: 3,
      },
    };
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/programs/programme-test?preview=true') {
        return Promise.resolve(
          jsonResponse({
            program: {
              canonicalProgramKey: 'programme-test',
              description: 'Un programme à reprendre.',
              estimatedDurationDays: 4,
              id: programId,
              locale: 'fr',
              slug: 'programme-test',
              stages: [
                {
                  description: 'Étape test',
                  estimatedDurationDays: 2,
                  estimatedMinutes: 60,
                  id: 'stage-1',
                  isPublished: true,
                  modules: [
                    {
                      id: 'module-1',
                      isPublished: true,
                      lessons: [lesson],
                      position: 1,
                      progress: { percent: 75, status: 'IN_PROGRESS' },
                      slug: 'module-test',
                      title: 'Module test',
                    },
                  ],
                  position: 1,
                  progress: { percent: 75, status: 'IN_PROGRESS' },
                  slug: 'etape-test',
                  timeline: {
                    actualPercent: 75,
                    completedAt: null,
                    expectedPercent: 50,
                    progressDelta: 25,
                    startedAt: '2026-08-01T00:00:00.000Z',
                    targetEndAt: null,
                    temporalStatus: 'ahead',
                  },
                  title: 'Étape test',
                },
              ],
              status: 'ACTIVE',
              timeline: {
                actualPercent: 75,
                completedAt: null,
                expectedPercent: 50,
                progressDelta: 25,
                startedAt: '2026-08-01T00:00:00.000Z',
                targetEndAt: null,
                temporalStatus: 'ahead',
              },
              title: 'Programme test',
              viewPreference: { expandedStageId: 'stage-1' },
              visibility: 'PRIVATE',
            },
          }),
        );
      }
      if (path === `/api/programs/${programId}/restart-preview`) {
        return Promise.resolve(jsonResponse({ preview }));
      }
      if (
        path === `/api/programs/${programId}/restart` &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(
          jsonResponse({
            result: {
              ...preview,
              idempotent: false,
              runIds: ['run-1'],
            },
          }),
        );
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      randomUUID: () => '33333333-3333-4333-8333-333333333333',
    });

    renderPage(<ProgramPage programSlug="programme-test" />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Recommencer ce programme',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Confirmer la reprise du programme',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 étapes, 1 modules, 2 leçons/)).toBeInTheDocument();
    expect(
      screen.getByText(/3 notes, 5 tentatives de quiz/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Oui, recommencer ce programme',
      }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/programs/${programId}/restart`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
