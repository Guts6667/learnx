import type { ReactNode } from 'react';
import { navigate as route } from '@/app/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
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
      <section
        aria-labelledby="offline-private-title"
        className="mx-auto max-w-md space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5 text-center"
        role="status"
      >
        <h1 className="text-xl font-semibold" id="offline-private-title">
          {t('offline.privateTitle')}
        </h1>
        <p className="text-sm leading-6 text-slate-300">
          {t('offline.privateDescription')}
        </p>
      </section>
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
      <section
        aria-labelledby="session-retry-title"
        className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5 text-center"
      >
        <h1 className="text-xl font-semibold" id="session-retry-title">
          {t('session.errorTitle')}
        </h1>
        <p className="text-sm leading-6 text-slate-300">
          {t('session.errorDescription')}
        </p>
        <Button
          isLoading={sessionQuery.isFetching}
          onClick={() => void sessionQuery.refetch()}
        >
          {t('common.retry')}
        </Button>
      </section>
    );
  }

  if (!sessionQuery.data?.user) {
    return null;
  }

  return <>{children}</>;
}
