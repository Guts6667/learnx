import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { AdminPage } from '@/pages/AdminPage';

const moduleId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const lessonId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

const adminUser = {
  displayName: 'Admin',
  email: 'admin@example.com',
  id: 'admin-1',
  role: 'ADMIN',
};

function curriculumResponse() {
  return {
    programs: [
      {
        id: 'program-1',
        slug: 'programme-test',
        stages: [
          {
            id: 'stage-1',
            isPublished: false,
            modules: [
              {
                description: 'Résumé du module',
                id: moduleId,
                isPublished: false,
                lessons: [
                  {
                    id: lessonId,
                    isPublished: false,
                    position: 1,
                    slug: 'lecon-test',
                    summary: 'Résumé de la leçon',
                    title: 'Leçon test',
                  },
                ],
                position: 1,
                slug: 'module-test',
                title: 'Module test',
              },
            ],
            position: 1,
            slug: 'etape-test',
            title: 'Étape test',
          },
        ],
        status: 'DRAFT',
        title: 'Programme test',
      },
    ],
  };
}

describe('AdminRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuse visuellement l’accès à un utilisateur non-admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(jsonResponse({ user: { ...adminUser, role: 'USER' } })),
      ),
    );

    render(
      <AppProviders>
        <AdminRoute>
          <p>Contenu secret</p>
        </AdminRoute>
      </AppProviders>,
    );

    expect(await screen.findByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Contenu secret')).not.toBeInTheDocument();
  });
});

describe('AdminPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche modules, leçons et statuts puis modifie un module', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse({ user: adminUser }));
      }
      if (path === `/api/admin/modules/${moduleId}`) {
        return Promise.resolve(
          jsonResponse({
            module: {
              ...curriculumResponse().programs[0].stages[0].modules[0],
              title: 'Module renommé',
            },
          }),
        );
      }

      expect(init?.method).toBeUndefined();
      return Promise.resolve(jsonResponse(curriculumResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage />
      </AppProviders>,
    );

    expect(await screen.findByText('Programme test')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Module test')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Leçon test')).toBeInTheDocument();
    expect(screen.getAllByText('Brouillon')).toHaveLength(4);

    fireEvent.input(screen.getByLabelText('Titre du module'), {
      target: { value: 'Module renommé' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le module' }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/modules/${moduleId}`,
      expect.objectContaining({
        body: JSON.stringify({
          description: 'Résumé du module',
          position: 1,
          title: 'Module renommé',
        }),
        method: 'PATCH',
      }),
    );
  });

  it('explique pourquoi une leçon incomplète ne peut pas être publiée', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse({ user: adminUser }));
      }
      if (
        path === `/api/admin/lessons/${lessonId}` &&
        init?.method === 'PATCH'
      ) {
        return Promise.resolve(
          jsonResponse(
            {
              error: {
                code: 'LESSON_NOT_READY',
                message: 'Lesson not ready.',
              },
            },
            409,
          ),
        );
      }

      return Promise.resolve(jsonResponse(curriculumResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Publier la leçon' }),
    );

    expect(
      await screen.findByText(
        'Publication impossible : publiez au moins une leçon prête et vérifiez les évaluations des notions obligatoires.',
      ),
    ).toBeInTheDocument();
  });

  it('affiche l’impact puis exige une confirmation avant la cascade', async () => {
    const plan = {
      action: 'PUBLISH',
      blockers: [],
      changes: [
        {
          from: false,
          id: moduleId,
          title: 'Module test',
          to: true,
          type: 'MODULE',
        },
        {
          from: false,
          id: lessonId,
          title: 'Leçon test',
          to: true,
          type: 'LESSON',
        },
      ],
      mode: 'FULL',
      planId: 'a'.repeat(64),
      target: { id: moduleId, title: 'Module test', type: 'MODULE' },
      warnings: [],
    };
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (path === '/api/auth/session') {
        return Promise.resolve(jsonResponse({ user: adminUser }));
      }
      if (path === '/api/admin/publication/preview') {
        expect(init?.method).toBe('POST');
        return Promise.resolve(jsonResponse({ plan }));
      }
      if (path === '/api/admin/publication/apply') {
        expect(init?.body).toBe(
          JSON.stringify({
            action: 'PUBLISH',
            mode: 'FULL',
            planId: plan.planId,
            targetId: moduleId,
            targetType: 'MODULE',
          }),
        );
        return Promise.resolve(jsonResponse({ plan }));
      }

      return Promise.resolve(jsonResponse(curriculumResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage />
      </AppProviders>,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Prévisualiser — publier Module test',
      }),
    );
    expect(
      await screen.findByText('Aperçu avant confirmation'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Publier la leçon « Leçon test »'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/publication/apply',
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmer — publier' }),
    );
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/publication/apply',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
