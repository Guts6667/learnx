import { render, screen } from '@testing-library/preact';
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
                  modules: [],
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
                  lessons: [],
                  position: 1,
                  slug: 'premiers-pas',
                  title: 'Premiers pas',
                },
              ],
              position: 1,
              slug: 'introduction',
              title: 'Introduction',
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
            lessons: [
              {
                estimatedMinutes: 10,
                id: 'lesson-1',
                isPublished: false,
                position: 1,
                slug: 'demarrer',
                summary: 'Les notions essentielles.',
                title: 'Démarrer',
              },
            ],
            position: 1,
            slug: 'premiers-pas',
            title: 'Premiers pas',
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const programView = renderPage(<ProgramPage programSlug="bases" />);
    expect(
      await screen.findByRole('link', { name: 'Ouvrir l’étape' }),
    ).toHaveAttribute('href', '/program/bases/stage/introduction');
    expect(screen.getByText('Brouillon')).toBeInTheDocument();

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

    stageView.unmount();
    renderPage(<ModulePage moduleSlug="premiers-pas" programSlug="bases" />);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Démarrer' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Brouillon')).not.toHaveLength(0);
  });
});
