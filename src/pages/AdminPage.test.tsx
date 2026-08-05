import { fireEvent, render, screen } from '@testing-library/preact';

import { AppProviders } from '@/app/providers';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { AdminPage } from '@/pages/AdminPage';

const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const stageId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
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

const program = {
  id: programId,
  position: 0,
  publishedVersion: null,
  slug: 'programme-test',
  status: 'DRAFT',
  title: 'Programme test',
  updatedAt: '2026-08-05T10:00:00.000Z',
  visibility: 'PRIVATE',
} as const;
const stage = {
  id: stageId,
  isPublished: false,
  position: 0,
  slug: 'etape-test',
  title: 'Étape test',
};
const module = {
  description: 'Résumé du module',
  id: moduleId,
  isPublished: false,
  position: 0,
  slug: 'module-test',
  title: 'Module test',
};
const lesson = {
  id: lessonId,
  isPublished: false,
  position: 0,
  slug: 'lecon-test',
  summary: 'Résumé de la leçon',
  title: 'Leçon test',
};

function moduleResponse() {
  return {
    kind: 'MODULE',
    module: {
      ...module,
      lessons: [lesson],
      stage: { ...stage, program },
    },
  };
}

function lessonResponse() {
  return {
    kind: 'LESSON',
    lesson: {
      ...lesson,
      module: { ...module, stage: { ...stage, program } },
    },
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

  it('ne charge que les programmes à la racine', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse({ kind: 'PROGRAMS', programs: [program] })),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage />
      </AppProviders>,
    );

    expect(await screen.findByText('Programme test')).toBeInTheDocument();
    expect(screen.queryByText('Étape test')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/programs',
      expect.any(Object),
    );
  });

  it('n’affiche que les enfants immédiats et enregistre la position zéro', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === `/api/admin/modules/${moduleId}` &&
        init?.method === 'PATCH'
      ) {
        return Promise.resolve(jsonResponse({ module }));
      }
      return Promise.resolve(jsonResponse(moduleResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage moduleId={moduleId} />
      </AppProviders>,
    );

    expect(await screen.findByText('Leçon test')).toBeInTheDocument();
    expect(screen.queryByText('Résumé de la leçon')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Étape test' })).toHaveAttribute(
      'href',
      `/admin/program/${programId}/stage/${stageId}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gérer ce contenu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le module' }),
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/modules/${moduleId}`,
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Résumé du module',
            position: 0,
            title: 'Module test',
          }),
          method: 'PATCH',
        }),
      );
    });
  });

  it('confirme séparément la visibilité du programme', async () => {
    const versionedProgram = {
      ...program,
      publishedVersion: {
        checksum: 'a'.repeat(64),
        id: 'version-1',
        publishedAt: '2026-08-05T10:00:00.000Z',
        version: 1,
      },
    };
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === `/api/admin/programs/${programId}/visibility` &&
        init?.method === 'PATCH'
      ) {
        return Promise.resolve(
          jsonResponse({
            program: {
              ...versionedProgram,
              status: 'DRAFT',
              visibility: 'PUBLIC',
            },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          kind: 'PROGRAM',
          program: { ...versionedProgram, stages: [stage] },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage programId={programId} />
      </AppProviders>,
    );

    await screen.findByRole('heading', { level: 1, name: 'Programme test' });
    expect(screen.getByText(/Version publiée : v1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gérer ce contenu' }));
    expect(screen.getByText('Privé')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Rendre visible par les membres' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/programs/${programId}/visibility`,
        expect.objectContaining({
          body: JSON.stringify({
            expectedUpdatedAt: program.updatedAt,
            visibility: 'PUBLIC',
          }),
          method: 'PATCH',
        }),
      );
    });
  });

  it('confirme une publication de leçon et annonce un blocage pédagogique', async () => {
    const fetchMock = vi.fn((path: string, init?: RequestInit) => {
      if (
        path === `/api/admin/lessons/${lessonId}` &&
        init?.method === 'PATCH'
      ) {
        return Promise.resolve(
          jsonResponse(
            { error: { code: 'LESSON_NOT_READY', message: 'Not ready.' } },
            409,
          ),
        );
      }
      return Promise.resolve(jsonResponse(lessonResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage lessonId={lessonId} />
      </AppProviders>,
    );

    await screen.findByText('Résumé de la leçon');
    fireEvent.click(screen.getByRole('button', { name: 'Gérer ce contenu' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Prévisualiser — publier la leçon' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    expect(
      await screen.findByText(
        'Publication impossible : vérifiez les évaluations des notions obligatoires.',
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
      if (path === '/api/admin/publication/preview') {
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
      return Promise.resolve(jsonResponse(moduleResponse()));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AdminPage moduleId={moduleId} />
      </AppProviders>,
    );

    await screen.findByText('Leçon test');
    fireEvent.click(screen.getByRole('button', { name: 'Gérer ce contenu' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Prévisualiser — publier' }),
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
