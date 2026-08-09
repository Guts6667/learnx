import type { ComponentChildren } from 'preact';
import { route } from 'preact-router';
import { useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionQuery } from '@/features/auth/session';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { isOfflineRequestError } from '@/lib/api-client';
import { normalizeUiLocale, useI18n } from '@/i18n';

interface ProtectedRouteProps {
  children: ComponentChildren;
  path?: string;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isOnline = useOnlineStatus();
  const sessionQuery = useSessionQuery();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { setLocale, t } = useI18n();

  useEffect(() => {
    if (sessionQuery.data?.user) {
      setLocale(normalizeUiLocale(sessionQuery.data.user.locale));
    }
  }, [sessionQuery.data?.user, setLocale]);

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
          {t('offline.privateTitle')}
        </h1>
        <p class="text-sm leading-6 text-slate-300">
          {t('offline.privateDescription')}
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
              ? t('session.reconnecting')
              : t('session.checking')
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
          {t('session.errorTitle')}
        </h1>
        <p class="text-sm leading-6 text-slate-300">
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
