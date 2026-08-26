import type { ComponentType } from 'react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';

import { navigate } from '@/app/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { PwaProvider } from '@/features/pwa/PwaStatus';
import { useI18n } from '@/i18n';

type LazyRouteModules = {
  './query-provider.tsx': typeof import('./query-provider');
  '../components/layout/MobileLayout.tsx': typeof import('../components/layout/MobileLayout');
  '../features/auth/AdminRoute.tsx': typeof import('../features/auth/AdminRoute');
  '../features/auth/ProtectedRoute.tsx': typeof import('../features/auth/ProtectedRoute');
  '../pages/AccessRequestPage.tsx': typeof import('../pages/AccessRequestPage');
  '../pages/ActivateAccountPage.tsx': typeof import('../pages/ActivateAccountPage');
  '../pages/AdminAccessRequestsPage.tsx': typeof import('../pages/AdminAccessRequestsPage');
  '../pages/AdminAccountsPage.tsx': typeof import('../pages/AdminAccountsPage');
  '../pages/AdminContactsPage.tsx': typeof import('../pages/AdminContactsPage');
  '../pages/AdminCreditsPage.tsx': typeof import('../pages/AdminCreditsPage');
  '../pages/AdminPage.tsx': typeof import('../pages/AdminPage');
  '../pages/ConceptAssessmentPage.tsx': typeof import('../pages/ConceptAssessmentPage');
  '../pages/CreditsPage.tsx': typeof import('../pages/CreditsPage');
  '../pages/CurriculumPages.tsx': typeof import('../pages/CurriculumPages');
  '../pages/ExercisePage.tsx': typeof import('../pages/ExercisePage');
  '../pages/LandingPage.tsx': typeof import('../pages/LandingPage');
  '../pages/LessonPage.tsx': typeof import('../pages/LessonPage');
  '../pages/LoginPage.tsx': typeof import('../pages/LoginPage');
  '../pages/NotesPage.tsx': typeof import('../pages/NotesPage');
  '../pages/PlaceholderPage.tsx': typeof import('../pages/PlaceholderPage');
  '../pages/ProfilePage.tsx': typeof import('../pages/ProfilePage');
  '../pages/ProgramsDirectoryPages.tsx': typeof import('../pages/ProgramsDirectoryPages');
  '../pages/PublicInterestPage.tsx': typeof import('../pages/PublicInterestPage');
  '../pages/QuizPage.tsx': typeof import('../pages/QuizPage');
  '../pages/ReviewsPage.tsx': typeof import('../pages/ReviewsPage');
  '../pages/TodayPage.tsx': typeof import('../pages/TodayPage');
  '../pages/TotemAdminPreviewPage.tsx': typeof import('../pages/TotemAdminPreviewPage');
  '../pages/TotemPrimitivesPage.tsx': typeof import('../pages/TotemPrimitivesPage');
  '../pages/TotemProductPreviewPage.tsx': typeof import('../pages/TotemProductPreviewPage');
  '../pages/VerifyEmailPage.tsx': typeof import('../pages/VerifyEmailPage');
};

type ComponentExport<
  ModulePath extends keyof LazyRouteModules,
  ExportName extends keyof LazyRouteModules[ModulePath],
> =
  LazyRouteModules[ModulePath][ExportName] extends ComponentType<infer Props>
    ? ComponentType<Props>
    : never;

const lazyRouteModules = import.meta.glob([
  './query-provider.tsx',
  '../components/layout/MobileLayout.tsx',
  '../features/auth/{AdminRoute,ProtectedRoute}.tsx',
  '../pages/*.tsx',
  '!../pages/*.test.tsx',
]) as {
  [ModulePath in keyof LazyRouteModules]: () => Promise<
    LazyRouteModules[ModulePath]
  >;
};

function lazyPage<
  ModulePath extends keyof LazyRouteModules,
  ExportName extends keyof LazyRouteModules[ModulePath],
>(modulePath: ModulePath, exportName: ExportName) {
  const loadModule = lazyRouteModules[modulePath];

  return lazy(async () => {
    const module = await loadModule();

    return {
      default: module[exportName] as ComponentExport<ModulePath, ExportName>,
    };
  });
}

const AdminRoute = lazyPage('../features/auth/AdminRoute.tsx', 'AdminRoute');
const AppQueryProvider = lazyPage('./query-provider.tsx', 'AppQueryProvider');
const MobileLayout = lazyPage(
  '../components/layout/MobileLayout.tsx',
  'MobileLayout',
);
const ProtectedRoute = lazyPage(
  '../features/auth/ProtectedRoute.tsx',
  'ProtectedRoute',
);
const AccessRequestPage = lazyPage(
  '../pages/AccessRequestPage.tsx',
  'AccessRequestPage',
);
const ActivateAccountPage = lazyPage(
  '../pages/ActivateAccountPage.tsx',
  'ActivateAccountPage',
);
const AdminAccessRequestsPage = lazyPage(
  '../pages/AdminAccessRequestsPage.tsx',
  'AdminAccessRequestsPage',
);
const AdminAccountsPage = lazyPage(
  '../pages/AdminAccountsPage.tsx',
  'AdminAccountsPage',
);
const AdminContactsPage = lazyPage(
  '../pages/AdminContactsPage.tsx',
  'AdminContactsPage',
);
const AdminCreditsPage = lazyPage(
  '../pages/AdminCreditsPage.tsx',
  'AdminCreditsPage',
);
const AdminPage = lazyPage('../pages/AdminPage.tsx', 'AdminPage');
const ConceptAssessmentPage = lazyPage(
  '../pages/ConceptAssessmentPage.tsx',
  'ConceptAssessmentPage',
);
const CreditsPage = lazyPage('../pages/CreditsPage.tsx', 'CreditsPage');
const ExercisePage = lazyPage('../pages/ExercisePage.tsx', 'ExercisePage');
const LandingPage = lazyPage('../pages/LandingPage.tsx', 'LandingPage');
const LessonPage = lazyPage('../pages/LessonPage.tsx', 'LessonPage');
const LoginPage = lazyPage('../pages/LoginPage.tsx', 'LoginPage');
const ModulePage = lazyPage('../pages/CurriculumPages.tsx', 'ModulePage');
const NewNotePage = lazyPage('../pages/NotesPage.tsx', 'NewNotePage');
const NotePage = lazyPage('../pages/NotesPage.tsx', 'NotePage');
const NotesPage = lazyPage('../pages/NotesPage.tsx', 'NotesPage');
const NotFoundPage = lazyPage('../pages/PlaceholderPage.tsx', 'NotFoundPage');
const ProfilePage = lazyPage('../pages/ProfilePage.tsx', 'ProfilePage');
const ProgramPage = lazyPage('../pages/CurriculumPages.tsx', 'ProgramPage');
const PublicInterestPage = lazyPage(
  '../pages/PublicInterestPage.tsx',
  'PublicInterestPage',
);
const QuizPage = lazyPage('../pages/QuizPage.tsx', 'QuizPage');
const ReviewsPage = lazyPage('../pages/ReviewsPage.tsx', 'ReviewsPage');
const StagePage = lazyPage('../pages/CurriculumPages.tsx', 'StagePage');
const TodayPage = lazyPage('../pages/TodayPage.tsx', 'TodayPage');
const TotemAdminPreviewPage = lazyPage(
  '../pages/TotemAdminPreviewPage.tsx',
  'TotemAdminPreviewPage',
);
const TotemPrimitivesPage = lazyPage(
  '../pages/TotemPrimitivesPage.tsx',
  'TotemPrimitivesPage',
);
const TotemProductPreviewPage = lazyPage(
  '../pages/TotemProductPreviewPage.tsx',
  'TotemProductPreviewPage',
);
const TotemProgramsPage = lazyPage(
  '../pages/ProgramsDirectoryPages.tsx',
  'TotemProgramsPage',
);
const DiscoverProgramsPage = lazyPage(
  '../pages/ProgramsDirectoryPages.tsx',
  'DiscoverProgramsPage',
);
const VerifyEmailPage = lazyPage(
  '../pages/VerifyEmailPage.tsx',
  'VerifyEmailPage',
);

interface RouteParams {
  assessmentId?: string;
  exerciseId?: string;
  lessonId?: string;
  lessonSlug?: string;
  moduleId?: string;
  moduleSlug?: string;
  noteId?: string;
  path?: string;
  programId?: string;
  programSlug?: string;
  quizId?: string;
  stageId?: string;
  stageSlug?: string;
}

function RouteElement({
  component: Component,
}: {
  component: ComponentType<RouteParams>;
}) {
  const params = useParams<keyof RouteParams>();

  return <Component {...params} />;
}

function RouteLoadingFallback() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-48 items-center justify-center">
      <Spinner label={t('common.loadingContent')} />
    </div>
  );
}

function PublicLayoutRoute() {
  return (
    <PwaProvider>
      <Outlet />
    </PwaProvider>
  );
}

function ApplicationLayoutRoute({ canGoBack }: { canGoBack: boolean }) {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <AppQueryProvider>
        <MobileLayout canGoBack={canGoBack} currentPath={location.pathname}>
          <Outlet />
        </MobileLayout>
      </AppQueryProvider>
    </Suspense>
  );
}

function AdminManagementRoute({
  lessonId,
  moduleId,
  path,
  programId,
  stageId,
}: RouteParams) {
  void path;

  return (
    <ProtectedRoute>
      <AdminRoute>
        <AdminPage
          lessonId={lessonId}
          moduleId={moduleId}
          programId={programId}
          stageId={stageId}
        />
      </AdminRoute>
    </ProtectedRoute>
  );
}

function AdminAccessRequestsRoute({ path }: RouteParams) {
  void path;

  return (
    <ProtectedRoute>
      <AdminRoute>
        <AdminAccessRequestsPage />
      </AdminRoute>
    </ProtectedRoute>
  );
}

function AdminAccountsRoute({ path }: RouteParams) {
  void path;

  return (
    <ProtectedRoute>
      <AdminRoute>
        <AdminAccountsPage />
      </AdminRoute>
    </ProtectedRoute>
  );
}

function AdminContactsRoute({ path }: RouteParams) {
  void path;

  return (
    <ProtectedRoute>
      <AdminRoute>
        <AdminContactsPage />
      </AdminRoute>
    </ProtectedRoute>
  );
}

function AdminCreditsRoute({ path }: RouteParams) {
  void path;
  return (
    <ProtectedRoute>
      <AdminRoute>
        <AdminCreditsPage />
      </AdminRoute>
    </ProtectedRoute>
  );
}

function NoteRoute({ noteId, path }: RouteParams) {
  void path;

  if (!noteId) return null;

  return (
    <ProtectedRoute>
      {noteId === 'new' ? <NewNotePage /> : <NotePage noteId={noteId} />}
    </ProtectedRoute>
  );
}

function ConceptAssessmentRoute({
  assessmentId,
  lessonSlug,
  path,
  programSlug,
}: RouteParams) {
  void path;

  if (!lessonSlug || !programSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <ConceptAssessmentPage
        assessmentId={assessmentId}
        lessonSlug={lessonSlug}
        programSlug={programSlug}
      />
    </ProtectedRoute>
  );
}

function LessonRoute({ lessonSlug, path, programSlug }: RouteParams) {
  void path;

  if (!lessonSlug || !programSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <LessonPage lessonSlug={lessonSlug} programSlug={programSlug} />
    </ProtectedRoute>
  );
}

function ExerciseRoute({
  exerciseId,
  lessonSlug,
  path,
  programSlug,
}: RouteParams) {
  void path;
  if (!exerciseId || !lessonSlug || !programSlug) return null;

  return (
    <ProtectedRoute>
      <ExercisePage
        exerciseId={exerciseId}
        lessonSlug={lessonSlug}
        programSlug={programSlug}
      />
    </ProtectedRoute>
  );
}

function QuizRoute({ lessonSlug, path, programSlug, quizId }: RouteParams) {
  void path;

  if (!lessonSlug || !programSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <QuizPage
        lessonSlug={lessonSlug}
        programSlug={programSlug}
        quizId={quizId}
      />
    </ProtectedRoute>
  );
}

function ProgramsRoute({ path }: RouteParams) {
  void path;

  return (
    <ProtectedRoute>
      <TotemProgramsPage />
    </ProtectedRoute>
  );
}

function DiscoverProgramsRoute({ path }: RouteParams) {
  void path;

  return (
    <ProtectedRoute>
      <DiscoverProgramsPage />
    </ProtectedRoute>
  );
}

function ProgramRoute({ path, programSlug }: RouteParams) {
  void path;

  if (!programSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <ProgramPage programSlug={programSlug} />
    </ProtectedRoute>
  );
}

function StageRoute({ path, programSlug, stageSlug }: RouteParams) {
  void path;

  if (!programSlug || !stageSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <StagePage programSlug={programSlug} stageSlug={stageSlug} />
    </ProtectedRoute>
  );
}

function ModuleRoute({ moduleSlug, path, programSlug }: RouteParams) {
  void path;

  if (!moduleSlug || !programSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <ModulePage moduleSlug={moduleSlug} programSlug={programSlug} />
    </ProtectedRoute>
  );
}

function AppRouteTree() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = location.pathname;

    if (!previous || previous === location.pathname) return;

    window.requestAnimationFrame(() => {
      window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
  }, [location.pathname]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>('a[href]')
          : null;

      if (
        !anchor ||
        anchor.hasAttribute('data-native') ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash
      ) {
        return;
      }

      event.preventDefault();
      navigate(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    }

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const routeContent = (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route element={<PublicLayoutRoute />}>
          <Route element={<LandingPage />} path="/" />
          <Route element={<PublicInterestPage />} path="/interest" />
          <Route element={<NotFoundPage />} path="*" />
        </Route>
        <Route
          element={
            <ApplicationLayoutRoute canGoBack={previousPath.current !== null} />
          }
        >
          {import.meta.env.DEV ? (
            <Route
              element={<TotemPrimitivesPage />}
              path="/design/totem-primitives"
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              element={<TotemAdminPreviewPage />}
              path="/design/totem-admin"
            />
          ) : null}
          {import.meta.env.DEV ? (
            <Route
              element={<TotemProductPreviewPage />}
              path="/design/totem-product"
            />
          ) : null}
          <Route
            element={
              <ProtectedRoute>
                <TodayPage />
              </ProtectedRoute>
            }
            path="/today"
          />
          <Route element={<LoginPage />} path="/login" />
          <Route element={<AccessRequestPage />} path="/request-access" />
          <Route element={<VerifyEmailPage />} path="/verify-email" />
          <Route element={<ActivateAccountPage />} path="/activate" />
          <Route
            element={<RouteElement component={ProgramsRoute} />}
            path="/program"
          />
          <Route
            element={<RouteElement component={DiscoverProgramsRoute} />}
            path="/discover"
          />
          <Route
            element={<RouteElement component={ProgramRoute} />}
            path="/program/:programSlug"
          />
          <Route
            element={<RouteElement component={StageRoute} />}
            path="/program/:programSlug/stage/:stageSlug"
          />
          <Route
            element={<RouteElement component={ModuleRoute} />}
            path="/program/:programSlug/module/:moduleSlug"
          />
          <Route
            element={<RouteElement component={ConceptAssessmentRoute} />}
            path="/program/:programSlug/lesson/:lessonSlug/assessment"
          />
          <Route
            element={<RouteElement component={QuizRoute} />}
            path="/program/:programSlug/lesson/:lessonSlug/quiz"
          />
          <Route
            element={<RouteElement component={ExerciseRoute} />}
            path="/program/:programSlug/lesson/:lessonSlug/exercise/:exerciseId"
          />
          <Route
            element={<RouteElement component={LessonRoute} />}
            path="/program/:programSlug/lesson/:lessonSlug"
          />
          <Route
            element={
              <ProtectedRoute>
                <ReviewsPage />
              </ProtectedRoute>
            }
            path="/reviews"
          />
          <Route
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            }
            path="/notes"
          />
          <Route
            element={<RouteElement component={NoteRoute} />}
            path="/notes/:noteId"
          />
          <Route
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
            path="/profile"
          />
          <Route
            element={
              <ProtectedRoute>
                <CreditsPage />
              </ProtectedRoute>
            }
            path="/credits"
          />
          <Route
            element={<RouteElement component={AdminAccessRequestsRoute} />}
            path="/admin/access-requests"
          />
          <Route
            element={<RouteElement component={AdminAccountsRoute} />}
            path="/admin/accounts"
          />
          <Route
            element={<RouteElement component={AdminContactsRoute} />}
            path="/admin/contacts"
          />
          <Route
            element={<RouteElement component={AdminCreditsRoute} />}
            path="/admin/credits"
          />
          <Route
            element={<RouteElement component={AdminManagementRoute} />}
            path="/admin/program/:programId/stage/:stageId/module/:moduleId/lesson/:lessonId"
          />
          <Route
            element={<RouteElement component={AdminManagementRoute} />}
            path="/admin/program/:programId/stage/:stageId/module/:moduleId"
          />
          <Route
            element={<RouteElement component={AdminManagementRoute} />}
            path="/admin/program/:programId/stage/:stageId"
          />
          <Route
            element={<RouteElement component={AdminManagementRoute} />}
            path="/admin/program/:programId"
          />
          <Route
            element={<RouteElement component={AdminManagementRoute} />}
            path="/admin"
          />
        </Route>
      </Routes>
    </Suspense>
  );

  return routeContent;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AppRouteTree />
    </BrowserRouter>
  );
}
