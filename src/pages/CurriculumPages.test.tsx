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

  it('affiche les programmes et leur progression indisponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            programs: [
              {
                description: 'Découvrir les bases.',
                id: 'program-1',
                slug: 'bases',
                stages: [],
                status: 'ACTIVE',
                title: 'Les bases',
              },
            ],
          }),
        ),
      ),
    );

    renderPage(<ProgramsPage />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Les bases' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', {
        name: 'Progression — bientôt disponible',
      }),
    ).toHaveAttribute('aria-valuenow', '0');
    expect(
      screen.getByRole('link', { name: 'Ouvrir le programme' }),
    ).toHaveAttribute('href', '/program/bases');
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
                  id: 'stage-1',
                  isPublished: false,
                  modules: [module],
                  position: 1,
                  slug: 'introduction',
                  title: 'Introduction',
                },
              ],
              status: 'ACTIVE',
              title: 'Les bases',
            },
          }),
        );
      }

      if (path === '/api/programs/bases/stages/introduction?preview=true') {
        return Promise.resolve(
          jsonResponse({
            stage: {
              estimatedDurationDays: null,
              id: 'stage-1',
              isPublished: false,
              modules: [
                {
                  id: 'module-1',
                  isPublished: false,
                  lessons: [lesson],
                  position: 1,
                  slug: 'premiers-pas',
                  title: 'Premiers pas',
                },
              ],
              position: 1,
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
      await screen.findByRole('link', { name: 'Prévisualiser' }),
    ).toHaveAttribute('href', '/program/bases/lesson/demarrer');
    expect(screen.getByText('10 min · 6 activités')).toBeInTheDocument();
    expect(
      screen.getByText('Prochaine activité : Reprendre l’activité en cours'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Progression — 25 %' }),
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
      if (path === '/api/modules/premiers-pas?preview=true') {
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
