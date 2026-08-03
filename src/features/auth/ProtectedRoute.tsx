import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';

import { Spinner } from '@/components/ui/Spinner';
import { useSessionQuery } from '@/features/auth/session';
import { useOnlineStatus } from '@/features/pwa/online-status';

interface ProtectedRouteProps {
  children: ComponentChildren;
  path?: string;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isOnline = useOnlineStatus();
  const sessionQuery = useSessionQuery();

  useEffect(() => {
    if (isOnline && !sessionQuery.isPending && !sessionQuery.data?.user) {
      route('/login', true);
    }
  }, [isOnline, sessionQuery.data?.user, sessionQuery.isPending]);

  if (!isOnline) {
    return (
      <section
        aria-labelledby="offline-private-title"
        class="mx-auto max-w-md space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5 text-center"
        role="status"
      >
        <h1 class="text-xl font-semibold" id="offline-private-title">
          Mode hors ligne
        </h1>
        <p class="text-sm leading-6 text-slate-300">
          Les contenus privés nécessitent une connexion. Reconnectez-vous pour
          reprendre exactement où vous en étiez.
        </p>
      </section>
    );
  }

  if (sessionQuery.isPending) {
    return (
      <section
        class="flex min-h-48 items-center justify-center"
        aria-live="polite"
      >
        <Spinner label="Vérification de la session" />
      </section>
    );
  }

  if (!sessionQuery.data?.user) {
    return null;
  }

  return <>{children}</>;
}
