import type { ReactNode } from 'react';
import { navigate as route } from '@/app/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { StatePanel } from '@/components/ui/StatePanel';
import { useSessionQuery } from '@/features/auth/session';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { normalizeUiLocale, useI18n } from '@/i18n';

interface ProtectedRouteProps {
  children: ReactNode;
  path?: string;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isOnline = useOnlineStatus();
  const sessionQuery = useSessionQuery();
  const { setLocale, t } = useI18n();

  useEffect(() => {
    if (sessionQuery.data?.user) {
      setLocale(normalizeUiLocale(sessionQuery.data.user.locale));
    }
  }, [sessionQuery.data?.user, setLocale]);

  useEffect(() => {
    if (
      isOnline &&
      !sessionQuery.isPending &&
      !sessionQuery.error &&
      !sessionQuery.data?.user
    ) {
      route('/login', true);
    }
  }, [
    isOnline,
    sessionQuery.data?.user,
    sessionQuery.error,
    sessionQuery.isPending,
  ]);

  if (!isOnline) {
    return (
      <StatePanel
        headingLevel={1}
        status="safe"
        title={t('offline.privateTitle')}
      >
        {t('offline.privateDescription')}
      </StatePanel>
    );
  }

  if (sessionQuery.isPending) {
    return (
      <section
        className="flex min-h-48 items-center justify-center"
        aria-live="polite"
      >
        <Spinner label={t('session.checking')} />
      </section>
    );
  }

  if (sessionQuery.error) {
    return (
      <ErrorState
        action={
          <Button
            isLoading={sessionQuery.isFetching}
            onClick={() => void sessionQuery.refetch()}
          >
            {t('common.retry')}
          </Button>
        }
        description={t('session.errorDescription')}
        headingLevel={1}
        title={t('session.errorTitle')}
      />
    );
  }

  if (!sessionQuery.data?.user) {
    return null;
  }

  return <>{children}</>;
}
