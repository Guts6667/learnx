import Router from 'preact-router';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import {
  ModulePage,
  ProgramPage,
  ProgramsPage,
  StagePage,
} from '@/pages/CurriculumPages';
import { ConceptAssessmentPage } from '@/pages/ConceptAssessmentPage';
import { LessonPage } from '@/pages/LessonPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotePage, NotesPage } from '@/pages/NotesPage';
import { NotFoundPage, PlaceholderPage } from '@/pages/PlaceholderPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { QuizPage } from '@/pages/QuizPage';
import { TodayPage } from '@/pages/TodayPage';

interface RouteParams {
  assessmentId?: string;
  lessonSlug?: string;
  moduleSlug?: string;
  noteId?: string;
  path?: string;
  programSlug?: string;
  quizId?: string;
  stageSlug?: string;
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
      <ProgramsPage />
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
  return (
    <MobileLayout>
      <Router>
        <ProtectedRoute path="/">
          <TodayPage />
        </ProtectedRoute>
        <ProtectedRoute path="/today">
          <TodayPage />
        </ProtectedRoute>
        <LoginPage path="/login" />
        <ProgramsRoute path="/program" />
        <ProgramRoute path="/program/:programSlug" />
        <StageRoute path="/program/:programSlug/stage/:stageSlug" />
        <ModuleRoute path="/program/:programSlug/module/:moduleSlug" />
        <ConceptAssessmentRoute path="/program/:programSlug/lesson/:lessonSlug/assessment" />
        <QuizRoute path="/program/:programSlug/lesson/:lessonSlug/quiz" />
        <LessonRoute path="/program/:programSlug/lesson/:lessonSlug" />
        <ProtectedRoute path="/reviews">
          <PlaceholderPage title="Révisions" />
        </ProtectedRoute>
        <ProtectedRoute path="/notes">
          <NotesPage />
        </ProtectedRoute>
        <NoteRoute path="/notes/:noteId" />
        <ProtectedRoute path="/profile">
          <ProfilePage />
        </ProtectedRoute>
        <ProtectedRoute path="/admin">
          <PlaceholderPage title="Administration" />
        </ProtectedRoute>
        <NotFoundPage default />
      </Router>
    </MobileLayout>
  );
}
