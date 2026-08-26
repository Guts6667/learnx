import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionQuery } from '@/features/auth/session';
import { useI18n } from '@/i18n';

export function AdminRoute({ children }: { children: ReactNode }) {
  const sessionQuery = useSessionQuery();
  const { t } = useI18n();

  if (sessionQuery.isPending) {
    return <Spinner label={t('admin.access.checking')} />;
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
        title={t('session.errorTitle')}
      />
    );
  }

  if (sessionQuery.data?.user?.role !== 'ADMIN') {
    return (
      <ErrorState
        description={t('admin.access.deniedDescription')}
        title={t('admin.access.deniedTitle')}
      />
    );
  }

  return <>{children}</>;
}
