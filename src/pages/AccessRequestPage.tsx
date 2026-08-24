import { useState } from 'preact/hooks';

import { actionClassNames } from '@/components/ui/actionStyles';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { useAccessRequestMutation } from '@/features/auth/access-request';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { ApiClientError } from '@/lib/api-client';
import { useI18n } from '@/i18n';

interface AccessRequestPageProps {
  path?: string;
}

export function AccessRequestPage({ path }: AccessRequestPageProps) {
  void path;
  const [email, setEmail] = useState('');
  const isOnline = useOnlineStatus();
  const requestMutation = useAccessRequestMutation();
  const { locale, t } = useI18n();
  const error = requestMutation.error;
  const errorMessage =
    error instanceof ApiClientError
      ? error.message
      : error
        ? t('auth.access.error')
        : undefined;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    try {
      await requestMutation.mutateAsync(email, locale);
    } catch {
      // The mutation state exposes the normalized API error accessibly.
    }
  }

  return (
    <section
      aria-labelledby="access-request-title"
      class="totem-auth-page page-shell"
    >
      <PageHeader
        description={t('auth.access.description')}
        eyebrow={t('auth.access.eyebrow')}
        id="access-request-title"
        title={t('auth.access.title')}
      />
      <OfflineBanner isOffline={!isOnline} message={t('auth.access.offline')} />
      <Card>
        {requestMutation.data ? (
          <div class="space-y-5" role="status">
            <h2 class="ui-text text-xl font-semibold">
              {t('auth.access.successTitle')}
            </h2>
            <p class="ui-text-muted leading-7">
              {t('auth.access.successDescription')}
            </p>
            <a
              class={actionClassNames('secondary', 'md', 'w-full')}
              href="/login"
            >
              {t('auth.backToLogin')}
            </a>
          </div>
        ) : (
          <form class="space-y-5" onSubmit={handleSubmit}>
            <TextField
              autoComplete="email"
              description={t('auth.access.emailDescription')}
              label={t('auth.email.label')}
              name="email"
              onInput={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
            {errorMessage ? (
              <p class="ui-text-danger text-sm" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button
              class="w-full"
              disabled={!isOnline}
              isLoading={requestMutation.isPending}
              type="submit"
            >
              {t('auth.access.submit')}
            </Button>
            <a class={actionClassNames('ghost', 'md', 'w-full')} href="/login">
              {t('auth.access.existingAccount')}
            </a>
          </form>
        )}
      </Card>
    </section>
  );
}
