import Router from 'preact-router';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage, PlaceholderPage } from '@/pages/PlaceholderPage';
import { ProfilePage } from '@/pages/ProfilePage';

export function AppRoutes() {
  return (
    <MobileLayout>
      <Router>
        <ProtectedRoute path="/">
          <PlaceholderPage title="Aujourd’hui" />
        </ProtectedRoute>
        <ProtectedRoute path="/today">
          <PlaceholderPage title="Aujourd’hui" />
        </ProtectedRoute>
        <LoginPage path="/login" />
        <ProtectedRoute path="/program">
          <PlaceholderPage
            title="Programmes"
            description="Vos parcours d’apprentissage apparaîtront ici."
          />
        </ProtectedRoute>
        <ProtectedRoute path="/program/:programSlug">
          <PlaceholderPage title="Programme" />
        </ProtectedRoute>
        <ProtectedRoute path="/program/:programSlug/stage/:stageSlug">
          <PlaceholderPage title="Étape" />
        </ProtectedRoute>
        <ProtectedRoute path="/program/:programSlug/module/:moduleSlug">
          <PlaceholderPage title="Module" />
        </ProtectedRoute>
        <ProtectedRoute path="/program/:programSlug/lesson/:lessonSlug/quiz">
          <PlaceholderPage title="Quiz" />
        </ProtectedRoute>
        <ProtectedRoute path="/program/:programSlug/lesson/:lessonSlug">
          <PlaceholderPage title="Leçon" />
        </ProtectedRoute>
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
