import Router from 'preact-router';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import {
  ModulePage,
  ProgramPage,
  ProgramsPage,
  StagePage,
} from '@/pages/CurriculumPages';
import { LessonPage } from '@/pages/LessonPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage, PlaceholderPage } from '@/pages/PlaceholderPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TodayPage } from '@/pages/TodayPage';

interface RouteParams {
  lessonSlug?: string;
  moduleSlug?: string;
  path?: string;
  programSlug?: string;
  stageSlug?: string;
}

function LessonRoute({ lessonSlug, path }: RouteParams) {
  void path;

  if (!lessonSlug) {
    return null;
  }

  return (
    <ProtectedRoute>
      <LessonPage lessonSlug={lessonSlug} />
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
        <ProtectedRoute path="/program/:programSlug/lesson/:lessonSlug/quiz">
          <PlaceholderPage title="Quiz" />
        </ProtectedRoute>
        <LessonRoute path="/program/:programSlug/lesson/:lessonSlug" />
        <ProtectedRoute path="/reviews">
          <PlaceholderPage title="Révisions" />
        </ProtectedRoute>
        <ProtectedRoute path="/notes">
          <PlaceholderPage title="Notes" />
        </ProtectedRoute>
        <ProtectedRoute path="/notes/:noteId">
          <PlaceholderPage title="Note" />
        </ProtectedRoute>
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
