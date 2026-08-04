import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionQuery } from '@/features/auth/session';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { isOfflineRequestError } from '@/lib/api-client';

interface ProtectedRouteProps {
  children: ComponentChildren;
  path?: string;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isOnline = useOnlineStatus();
  const sessionQuery = useSessionQuery();
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (
      isOnline &&
      !isReconnecting &&
      isOfflineRequestError(sessionQuery.error)
    ) {
      setIsReconnecting(true);

      void sessionQuery.refetch().finally(() => {
        if (navigator.onLine) {
          setIsReconnecting(false);
        }
      });
    }
  }, [
    isOnline,
    isReconnecting,
    sessionQuery.error,
    sessionQuery.refetch,
  ]);

  useEffect(() => {
    if (
      isOnline &&
      !isReconnecting &&
      !sessionQuery.isPending &&
      !sessionQuery.error &&
      !sessionQuery.data?.user
    ) {
      route('/login', true);
    }
  }, [
    isOnline,
    isReconnecting,
    sessionQuery.data?.user,
    sessionQuery.error,
    sessionQuery.isPending,
  ]);

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
          Les contenus et actions privés nécessitent une connexion. Cette page
          reste mémorisée : reconnectez-vous pour reprendre exactement où vous
          en étiez.
        </p>
      </section>
    );
  }

  if (isReconnecting || sessionQuery.isPending) {
    return (
      <section
        class="flex min-h-48 items-center justify-center"
        aria-live="polite"
      >
        <Spinner
          label={
            isReconnecting
              ? 'Reconnexion et vérification de la session'
              : 'Vérification de la session'
          }
        />
      </section>
    );
  }

  if (sessionQuery.error) {
    return (
      <section
        aria-labelledby="session-retry-title"
        class="mx-auto max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5 text-center"
      >
        <h1 class="text-xl font-semibold" id="session-retry-title">
          Connexion impossible
        </h1>
        <p class="text-sm leading-6 text-slate-300">
          La session n’a pas pu être vérifiée. Votre destination est conservée.
        </p>
        <Button
          isLoading={sessionQuery.isFetching}
          onClick={() => void sessionQuery.refetch()}
        >
          Réessayer
        </Button>
      </section>
    );
  }

  if (!sessionQuery.data?.user) {
    return null;
  }

  return <>{children}</>;
}
