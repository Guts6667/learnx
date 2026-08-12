import Router, { type RouterOnChangeArgs } from 'preact-router';
import { useCallback, useState } from 'preact/hooks';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { AdminRoute } from '@/features/auth/AdminRoute';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import {
  ModulePage,
  ProgramPage,
  StagePage,
} from '@/pages/CurriculumPages';
import {
  DiscoverProgramsPage,
  TotemProgramsPage,
} from '@/pages/ProgramsDirectoryPages';
import { ConceptAssessmentPage } from '@/pages/ConceptAssessmentPage';
import { LessonPage } from '@/pages/LessonPage';
import { ExercisePage } from '@/pages/ExercisePage';
import { LoginPage } from '@/pages/LoginPage';
import { AccessRequestPage } from '@/pages/AccessRequestPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { NotePage, NotesPage } from '@/pages/NotesPage';
import { NotFoundPage } from '@/pages/PlaceholderPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { QuizPage } from '@/pages/QuizPage';
import { ReviewsPage } from '@/pages/ReviewsPage';
import { TodayPage } from '@/pages/TodayPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminAccessRequestsPage } from '@/pages/AdminAccessRequestsPage';
import { AdminAccountsPage } from '@/pages/AdminAccountsPage';
import { AdminContactsPage } from '@/pages/AdminContactsPage';
import { AdminCreditsPage } from '@/pages/AdminCreditsPage';
import { CreditsPage } from '@/pages/CreditsPage';
import { ActivateAccountPage } from '@/pages/ActivateAccountPage';
import { LandingPage } from '@/pages/LandingPage';
import { PublicInterestPage } from '@/pages/PublicInterestPage';

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
      <NotePage noteId={noteId} />
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

export function AppRoutes() {
  const [navigation, setNavigation] = useState(() => ({
    canGoBack: false,
    currentPath: window.location.pathname,
  }));
  const handleRouteChange = useCallback(
    ({ previous, url }: RouterOnChangeArgs) => {
      setNavigation({
        canGoBack: Boolean(previous),
        currentPath: new URL(url, window.location.origin).pathname,
      });

      if (previous) {
        window.requestAnimationFrame(() => {
          document.getElementById('main-content')?.focus();
        });
      }
    },
    [],
  );

  return (
    <MobileLayout {...navigation}>
      <Router onChange={handleRouteChange}>
        <LandingPage path="/" />
        <PublicInterestPage path="/interest" />
        <ProtectedRoute path="/today">
          <TodayPage />
        </ProtectedRoute>
        <LoginPage path="/login" />
        <AccessRequestPage path="/request-access" />
        <VerifyEmailPage path="/verify-email" />
        <ActivateAccountPage path="/activate" />
        <ProgramsRoute path="/program" />
        <DiscoverProgramsRoute path="/discover" />
        <ProgramRoute path="/program/:programSlug" />
        <StageRoute path="/program/:programSlug/stage/:stageSlug" />
        <ModuleRoute path="/program/:programSlug/module/:moduleSlug" />
        <ConceptAssessmentRoute path="/program/:programSlug/lesson/:lessonSlug/assessment" />
        <QuizRoute path="/program/:programSlug/lesson/:lessonSlug/quiz" />
        <ExerciseRoute path="/program/:programSlug/lesson/:lessonSlug/exercise/:exerciseId" />
        <LessonRoute path="/program/:programSlug/lesson/:lessonSlug" />
        <ProtectedRoute path="/reviews">
          <ReviewsPage />
        </ProtectedRoute>
        <ProtectedRoute path="/notes">
          <NotesPage />
        </ProtectedRoute>
        <NoteRoute path="/notes/:noteId" />
        <ProtectedRoute path="/profile">
          <ProfilePage />
        </ProtectedRoute>
        <ProtectedRoute path="/credits">
          <CreditsPage />
        </ProtectedRoute>
        <AdminAccessRequestsRoute path="/admin/access-requests" />
        <AdminAccountsRoute path="/admin/accounts" />
        <AdminContactsRoute path="/admin/contacts" />
        <AdminCreditsRoute path="/admin/credits" />
        <AdminManagementRoute path="/admin/program/:programId/stage/:stageId/module/:moduleId/lesson/:lessonId" />
        <AdminManagementRoute path="/admin/program/:programId/stage/:stageId/module/:moduleId" />
        <AdminManagementRoute path="/admin/program/:programId/stage/:stageId" />
        <AdminManagementRoute path="/admin/program/:programId" />
        <AdminManagementRoute path="/admin" />
        <NotFoundPage default />
      </Router>
    </MobileLayout>
  );
}
