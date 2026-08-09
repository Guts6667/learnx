import { route } from 'preact-router';
import { useEffect, useState } from 'preact/hooks';

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
      <section class="mx-auto min-h-48 max-w-xl" aria-live="polite">
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

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    try {
      await loginMutation.mutateAsync({ email, password });
      route('/today', true);
    } catch {
      // The mutation state provides an accessible error message to the user.
    }
  }

  return (
    <section aria-labelledby="login-title" class="page-shell mx-auto max-w-xl">
      <PageHeader
        description={t('auth.login.description')}
        eyebrow={t('auth.login.eyebrow')}
        id="login-title"
        title={t('auth.login.title')}
      />
      <OfflineBanner isOffline={!isOnline} message={t('auth.login.offline')} />
      <Card>
        <form class="space-y-5" onSubmit={handleSubmit}>
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
            <p class="text-sm text-red-300" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button
            class="w-full"
            disabled={!isOnline}
            isLoading={loginMutation.isPending}
            type="submit"
          >
            {t('auth.login.submit')}
          </Button>
          <a
            class={actionClassNames('secondary', 'md', 'w-full')}
            href="/request-access"
          >
            {t('auth.login.requestAccess')}
          </a>
        </form>
      </Card>
    </section>
  );
}
