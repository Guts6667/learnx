import type { ComponentChildren } from 'preact';

import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionQuery } from '@/features/auth/session';

export function AdminRoute({ children }: { children: ComponentChildren }) {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isPending) {
    return <Spinner label="Vérification des droits administrateur" />;
  }

  if (sessionQuery.data?.user?.role !== 'ADMIN') {
    return (
      <ErrorState
        description="Cette zone est réservée aux administrateurs."
        title="Accès refusé"
      />
    );
  }

  return <>{children}</>;
}
