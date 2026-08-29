import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const routeSpies = vi.hoisted(() => ({
  navigate: vi.fn(),
  page: vi.fn(),
}));

function recordPage(name: string) {
  return (props: unknown) => {
    routeSpies.page(name, props);
    return null;
  };
}

vi.mock('@/app/navigation', () => ({ navigate: routeSpies.navigate }));
vi.mock('@/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/ui/Spinner', () => ({ Spinner: () => null }));
vi.mock('@/features/pwa/PwaStatus', () => ({
  PwaProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./query-provider', () => ({
  AppQueryProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../components/layout/MobileLayout', () => ({
  MobileLayout: ({
    canGoBack,
    children,
    currentPath,
  }: {
    canGoBack: boolean;
    children: ReactNode;
    currentPath: string;
  }) => (
    <main
      data-can-go-back={String(canGoBack)}
      data-current-path={currentPath}
      id="main-content"
      tabIndex={-1}
    >
      {children}
    </main>
  ),
}));
vi.mock('../features/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../features/auth/AdminRoute', () => ({
  AdminRoute: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../pages/LandingPage', () => ({
  LandingPage: recordPage('landing'),
}));
vi.mock('../pages/PublicInterestPage', () => ({
  PublicInterestPage: recordPage('interest'),
}));
vi.mock('../pages/PlaceholderPage', () => ({
  NotFoundPage: recordPage('not-found'),
}));
vi.mock('../pages/LoginPage', () => ({ LoginPage: recordPage('login') }));
vi.mock('../pages/AccessRequestPage', () => ({
  AccessRequestPage: recordPage('request-access'),
}));
vi.mock('../pages/VerifyEmailPage', () => ({
  VerifyEmailPage: recordPage('verify-email'),
}));
vi.mock('../pages/ActivateAccountPage', () => ({
  ActivateAccountPage: recordPage('activate'),
}));
vi.mock('../pages/ProgramsDirectoryPages', () => ({
  DiscoverProgramsPage: recordPage('discover'),
  TotemProgramsPage: recordPage('programs'),
}));
vi.mock('../pages/CurriculumPages', () => ({
  ModulePage: recordPage('module'),
  ProgramPage: recordPage('program'),
  StagePage: recordPage('stage'),
}));
vi.mock('../pages/ConceptAssessmentPage', () => ({
  ConceptAssessmentPage: recordPage('assessment'),
}));
vi.mock('../pages/QuizPage', () => ({ QuizPage: recordPage('quiz') }));
vi.mock('../pages/ExercisePage', () => ({
  ExercisePage: recordPage('exercise'),
}));
vi.mock('../pages/LessonPage', () => ({
  LessonPage: recordPage('lesson'),
}));
vi.mock('../pages/NotesPage', () => ({
  NewNotePage: recordPage('new-note'),
  NotePage: recordPage('note'),
  NotesPage: recordPage('notes'),
}));
vi.mock('../pages/AdminPage', () => ({ AdminPage: recordPage('admin') }));
vi.mock('../pages/AdminAccessRequestsPage', () => ({
  AdminAccessRequestsPage: recordPage('admin-access-requests'),
}));
vi.mock('../pages/AdminAccountsPage', () => ({
  AdminAccountsPage: recordPage('admin-accounts'),
}));
vi.mock('../pages/AdminContactsPage', () => ({
  AdminContactsPage: recordPage('admin-contacts'),
}));
vi.mock('../pages/AdminCreditsPage', () => ({
  AdminCreditsPage: recordPage('admin-credits'),
}));
vi.mock('../pages/TodayPage', () => ({ TodayPage: recordPage('today') }));
vi.mock('../pages/ReviewsPage', () => ({
  ReviewsPage: recordPage('reviews'),
}));
vi.mock('../pages/ProfilePage', () => ({
  ProfilePage: recordPage('profile'),
}));
vi.mock('../pages/CreditsPage', () => ({
  CreditsPage: recordPage('credits'),
}));
vi.mock('../pages/TotemPrimitivesPage', () => ({
  TotemPrimitivesPage: recordPage('totem-primitives'),
}));
vi.mock('../pages/TotemAdminPreviewPage', () => ({
  TotemAdminPreviewPage: recordPage('totem-admin'),
}));
vi.mock('../pages/TotemProductPreviewPage', () => ({
  TotemProductPreviewPage: recordPage('totem-product'),
}));

import { AppRoutes } from '@/app/routes';

async function renderPath(pathname: string, expectedPage: string) {
  window.history.replaceState({}, '', pathname);
  render(<AppRoutes />);
  await waitFor(() =>
    expect(routeSpies.page).toHaveBeenCalledWith(
      expectedPage,
      expect.anything(),
    ),
  );
}

describe('AppRoutes', () => {
  beforeEach(() => {
    routeSpies.navigate.mockReset();
    routeSpies.page.mockReset();
  });

  afterEach(() => cleanup());

  it.each([
    ['/', 'landing'],
    ['/interest', 'interest'],
    ['/unknown', 'not-found'],
    ['/login', 'login'],
    ['/request-access', 'request-access'],
    ['/verify-email', 'verify-email'],
    ['/activate', 'activate'],
    ['/today', 'today'],
    ['/program', 'programs'],
    ['/discover', 'discover'],
    ['/reviews', 'reviews'],
    ['/notes', 'notes'],
    ['/profile', 'profile'],
    ['/credits', 'credits'],
    ['/design/totem-primitives', 'totem-primitives'],
    ['/design/totem-admin', 'totem-admin'],
    ['/design/totem-product', 'totem-product'],
  ])('rend la route publique %s', async (pathname, expectedPage) => {
    await renderPath(pathname, expectedPage);
  });

  it.each([
    ['/program/parcours', 'program', { programSlug: 'parcours' }],
    [
      '/program/parcours/stage/cadrage',
      'stage',
      { programSlug: 'parcours', stageSlug: 'cadrage' },
    ],
    [
      '/program/parcours/module/fondations',
      'module',
      { moduleSlug: 'fondations', programSlug: 'parcours' },
    ],
    [
      '/program/parcours/lesson/introduction',
      'lesson',
      { lessonSlug: 'introduction', programSlug: 'parcours' },
    ],
    [
      '/program/parcours/lesson/introduction/assessment',
      'assessment',
      {
        assessmentId: undefined,
        lessonSlug: 'introduction',
        programSlug: 'parcours',
      },
    ],
    [
      '/program/parcours/lesson/introduction/quiz',
      'quiz',
      {
        lessonSlug: 'introduction',
        programSlug: 'parcours',
        quizId: undefined,
      },
    ],
    [
      '/program/parcours/lesson/introduction/exercise/exercice-1',
      'exercise',
      {
        exerciseId: 'exercice-1',
        lessonSlug: 'introduction',
        programSlug: 'parcours',
      },
    ],
    ['/notes/new', 'new-note', {}],
    ['/notes/note-1', 'note', { noteId: 'note-1' }],
  ])(
    'transmet les paramètres de %s à la page métier',
    async (pathname, expectedPage, expectedProps) => {
      await renderPath(pathname, expectedPage);
      expect(routeSpies.page).toHaveBeenCalledWith(
        expectedPage,
        expect.objectContaining(expectedProps),
      );
    },
  );

  it.each([
    [
      '/program/parcours/lesson/introduction/assessment?assessmentId=assessment-2',
      'assessment',
      { assessmentId: 'assessment-2' },
    ],
    [
      '/program/parcours/lesson/introduction/quiz?quizId=quiz-2',
      'quiz',
      { quizId: 'quiz-2' },
    ],
  ])(
    'transmet le sélecteur de recherche de %s à la page métier',
    async (pathname, expectedPage, expectedProps) => {
      await renderPath(pathname, expectedPage);
      expect(routeSpies.page).toHaveBeenCalledWith(
        expectedPage,
        expect.objectContaining(expectedProps),
      );
    },
  );

  it.each([
    ['/admin/access-requests', 'admin-access-requests'],
    ['/admin/accounts', 'admin-accounts'],
    ['/admin/contacts', 'admin-contacts'],
    ['/admin/credits', 'admin-credits'],
    ['/admin', 'admin'],
    ['/admin/program/program-1', 'admin'],
    ['/admin/program/program-1/stage/stage-1', 'admin'],
    ['/admin/program/program-1/stage/stage-1/module/module-1', 'admin'],
    [
      '/admin/program/program-1/stage/stage-1/module/module-1/lesson/lesson-1',
      'admin',
    ],
  ])('rend la surface d’administration %s', async (pathname, expectedPage) => {
    await renderPath(pathname, expectedPage);
  });

  it('intercepte uniquement les navigations internes confiées au routeur', async () => {
    await renderPath('/', 'landing');
    const host = document.createElement('div');
    host.innerHTML = `
      <a href="/today?source=test#suite"><span id="internal">Interne</span></a>
      <a href="https://example.com/path" id="external">Externe</a>
      <a href="#section" download id="download">Télécharger</a>
      <a href="#section" data-native id="native">Natif</a>
      <a href="#section" target="_blank" id="blank">Nouvel onglet</a>
      <a href="#section" id="hash">Section</a>
      <a href="#section" id="modified">Modificateurs</a>
    `;
    document.body.append(host);

    fireEvent.click(host.querySelector('#internal') as Element);
    expect(routeSpies.navigate).toHaveBeenCalledWith(
      '/today?source=test#suite',
    );

    for (const selector of [
      '#external',
      '#download',
      '#native',
      '#blank',
      '#hash',
    ]) {
      fireEvent.click(host.querySelector(selector) as Element);
    }
    expect(routeSpies.navigate).toHaveBeenCalledTimes(1);

    const modified = host.querySelector('#modified') as Element;
    fireEvent.click(modified, { ctrlKey: true });
    fireEvent.click(modified, { metaKey: true });
    fireEvent.click(modified, { shiftKey: true });
    fireEvent.click(modified, { altKey: true });
    fireEvent.click(modified, { button: 1 });
    expect(routeSpies.navigate).toHaveBeenCalledTimes(1);

    host.remove();
  });
});
