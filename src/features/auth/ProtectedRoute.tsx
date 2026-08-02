import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useEffect } from 'preact/hooks';

import { Spinner } from '@/components/ui/Spinner';
import { useSessionQuery } from '@/features/auth/session';

interface ProtectedRouteProps {
  children: ComponentChildren;
  path?: string;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const sessionQuery = useSessionQuery();

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data?.user) {
      route('/login', true);
    }
  }, [sessionQuery.data?.user, sessionQuery.isPending]);

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
