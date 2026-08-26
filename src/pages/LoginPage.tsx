import { navigate as route } from '@/app/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { actionClassNames } from '@/components/ui/actionStyles';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { ApiClientError } from '@/lib/api-client';
import { useLoginMutation, useSessionQuery } from '@/features/auth/session';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { useI18n } from '@/i18n';

interface LoginPageProps {
  path?: string;
}

export function LoginPage({ path }: LoginPageProps) {
  void path;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isOnline = useOnlineStatus();
  const loginMutation = useLoginMutation();
  const sessionQuery = useSessionQuery();
  const { t } = useI18n();

  useEffect(() => {
    if (sessionQuery.data?.user) {
      route('/today', true);
    }
  }, [sessionQuery.data?.user]);

  if (sessionQuery.isPending) {
    return (
      <section className="mx-auto min-h-48 max-w-xl" aria-live="polite">
        <Skeleton label={t('auth.login.sessionCheck')} />
      </section>
    );
  }

  if (sessionQuery.data?.user) {
    return null;
  }

  const error = loginMutation.error;
  const errorMessage =
    error instanceof ApiClientError
      ? error.message
      : error
        ? t('auth.login.error')
        : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loginMutation.mutateAsync({ email, password });
      route('/today', true);
    } catch {
      // The mutation state provides an accessible error message to the user.
    }
  }

  return (
    <section
      aria-labelledby="login-title"
      className="totem-auth-page page-shell"
    >
      <PageHeader
        description={t('auth.login.description')}
        eyebrow={t('auth.login.eyebrow')}
        id="login-title"
        title={t('auth.login.title')}
      />
      <OfflineBanner isOffline={!isOnline} message={t('auth.login.offline')} />
      <Card>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            autoComplete="email"
            label={t('auth.email.label')}
            name="email"
            onInput={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
          <TextField
            autoComplete="current-password"
            label={t('auth.password.label')}
            name="password"
            onInput={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
          {errorMessage ? (
            <p className="ui-text-danger text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={!isOnline}
            isLoading={loginMutation.isPending}
            type="submit"
          >
            {t('auth.login.submit')}
          </Button>
          <a
            className={actionClassNames('secondary', 'md', 'w-full')}
            href="/request-access"
          >
            {t('auth.login.requestAccess')}
          </a>
        </form>
      </Card>
    </section>
  );
}
