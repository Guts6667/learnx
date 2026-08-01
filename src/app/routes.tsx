import Router from 'preact-router';

import { MobileLayout } from '@/components/layout/MobileLayout';
import { NotFoundPage, PlaceholderPage } from '@/pages/PlaceholderPage';

export function AppRoutes() {
  return (
    <MobileLayout>
      <Router>
        <PlaceholderPage path="/" title="Aujourd’hui" />
        <PlaceholderPage path="/today" title="Aujourd’hui" />
        <PlaceholderPage
          path="/login"
          title="Connexion"
          description="L’accès au compte sera implémenté dans le ticket d’authentification."
        />
        <PlaceholderPage
          path="/program"
          title="Programmes"
          description="Vos parcours d’apprentissage apparaîtront ici."
        />
        <PlaceholderPage path="/program/:programSlug" title="Programme" />
        <PlaceholderPage
          path="/program/:programSlug/stage/:stageSlug"
          title="Étape"
        />
        <PlaceholderPage
          path="/program/:programSlug/module/:moduleSlug"
          title="Module"
        />
        <PlaceholderPage
          path="/program/:programSlug/lesson/:lessonSlug/quiz"
          title="Quiz"
        />
        <PlaceholderPage
          path="/program/:programSlug/lesson/:lessonSlug"
          title="Leçon"
        />
        <PlaceholderPage path="/reviews" title="Révisions" />
        <PlaceholderPage path="/notes" title="Notes" />
        <PlaceholderPage path="/notes/:noteId" title="Note" />
        <PlaceholderPage path="/profile" title="Profil" />
        <PlaceholderPage path="/admin" title="Administration" />
        <NotFoundPage default />
      </Router>
    </MobileLayout>
  );
}
