import type { ComponentType } from 'react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';

import { navigate } from '@/app/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { PwaProvider } from '@/features/pwa/PwaStatus';
import { useI18n } from '@/i18n';

const AdminRoute = lazy(() =>
  import('@/features/auth/AdminRoute').then((module) => ({
    default: module.AdminRoute,
  })),
);
const AppQueryProvider = lazy(() =>
  import('@/app/query-provider').then((module) => ({
    default: module.AppQueryProvider,
  })),
);
const MobileLayout = lazy(() =>
  import('@/components/layout/MobileLayout').then((module) => ({
    default: module.MobileLayout,
  })),
);
const ProtectedRoute = lazy(() =>
  import('@/features/auth/ProtectedRoute').then((module) => ({
    default: module.ProtectedRoute,
  })),
);

const AccessRequestPage = lazy(() =>
  import('@/pages/AccessRequestPage').then((module) => ({
    default: module.AccessRequestPage,
  })),
);
const ActivateAccountPage = lazy(() =>
  import('@/pages/ActivateAccountPage').then((module) => ({
    default: module.ActivateAccountPage,
  })),
);
const AdminAccessRequestsPage = lazy(() =>
  import('@/pages/AdminAccessRequestsPage').then((module) => ({
    default: module.AdminAccessRequestsPage,
  })),
);
const AdminAccountsPage = lazy(() =>
  import('@/pages/AdminAccountsPage').then((module) => ({
    default: module.AdminAccountsPage,
  })),
);
const AdminContactsPage = lazy(() =>
  import('@/pages/AdminContactsPage').then((module) => ({
    default: module.AdminContactsPage,
  })),
);
const AdminCreditsPage = lazy(() =>
  import('@/pages/AdminCreditsPage').then((module) => ({
    default: module.AdminCreditsPage,
  })),
);
const AdminPage = lazy(() =>
  import('@/pages/AdminPage').then((module) => ({
    default: module.AdminPage,
  })),
);
const ConceptAssessmentPage = lazy(() =>
  import('@/pages/ConceptAssessmentPage').then((module) => ({
    default: module.ConceptAssessmentPage,
  })),
);
const CreditsPage = lazy(() =>
  import('@/pages/CreditsPage').then((module) => ({
    default: module.CreditsPage,
  })),
);
const ExercisePage = lazy(() =>
  import('@/pages/ExercisePage').then((module) => ({
    default: module.ExercisePage,
  })),
);
const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((module) => ({
    default: module.LandingPage,
  })),
);
const LessonPage = lazy(() =>
  import('@/pages/LessonPage').then((module) => ({
    default: module.LessonPage,
  })),
);
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
);
const ModulePage = lazy(() =>
  import('@/pages/CurriculumPages').then((module) => ({
    default: module.ModulePage,
  })),
);
const NewNotePage = lazy(() =>
  import('@/pages/NotesPage').then((module) => ({
    default: module.NewNotePage,
  })),
);
const NotePage = lazy(() =>
  import('@/pages/NotesPage').then((module) => ({
    default: module.NotePage,
  })),
);
const NotesPage = lazy(() =>
  import('@/pages/NotesPage').then((module) => ({
    default: module.NotesPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/PlaceholderPage').then((module) => ({
    default: module.NotFoundPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  })),
);
const ProgramPage = lazy(() =>
  import('@/pages/CurriculumPages').then((module) => ({
    default: module.ProgramPage,
  })),
);
const PublicInterestPage = lazy(() =>
  import('@/pages/PublicInterestPage').then((module) => ({
    default: module.PublicInterestPage,
  })),
);
const QuizPage = lazy(() =>
  import('@/pages/QuizPage').then((module) => ({
    default: module.QuizPage,
  })),
);
const ReviewsPage = lazy(() =>
  import('@/pages/ReviewsPage').then((module) => ({
    default: module.ReviewsPage,
  })),
);
const StagePage = lazy(() =>
  import('@/pages/CurriculumPages').then((module) => ({
    default: module.StagePage,
  })),
);
const TodayPage = lazy(() =>
  import('@/pages/TodayPage').then((module) => ({
    default: module.TodayPage,
  })),
);
const TotemAdminPreviewPage = lazy(() =>
  import('@/pages/TotemAdminPreviewPage').then((module) => ({
    default: module.TotemAdminPreviewPage,
  })),
);
const TotemPrimitivesPage = lazy(() =>
  import('@/pages/TotemPrimitivesPage').then((module) => ({
    default: module.TotemPrimitivesPage,
  })),
);
const TotemProductPreviewPage = lazy(() =>
  import('@/pages/TotemProductPreviewPage').then((module) => ({
    default: module.TotemProductPreviewPage,
  })),
);
const TotemProgramsPage = lazy(() =>
  import('@/pages/ProgramsDirectoryPages').then((module) => ({
    default: module.TotemProgramsPage,
  })),
);
const DiscoverProgramsPage = lazy(() =>
  import('@/pages/ProgramsDirectoryPages').then((module) => ({
    default: module.DiscoverProgramsPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import('@/pages/VerifyEmailPage').then((module) => ({
    default: module.VerifyEmailPage,
  })),
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
        <Route element={<LandingPage />} path="/" />
        <Route element={<PublicInterestPage />} path="/interest" />
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
        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </Suspense>
  );

  if (location.pathname === '/' || location.pathname === '/interest') {
    return <PwaProvider>{routeContent}</PwaProvider>;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <AppQueryProvider>
        <MobileLayout
          canGoBack={previousPath.current !== null}
          currentPath={location.pathname}
        >
          {routeContent}
        </MobileLayout>
      </AppQueryProvider>
    </Suspense>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AppRouteTree />
    </BrowserRouter>
  );
}
