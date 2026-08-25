import { useState } from 'preact/hooks';

import { actionClassNames } from '@/components/ui/actionStyles';
import { Button } from '@/components/ui/Button';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useEmailVerificationMutation } from '@/features/auth/access-request';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { ApiClientError } from '@/lib/api-client';
import { useI18n } from '@/i18n';

interface VerifyEmailPageProps {
  path?: string;
}

function readTokenFromFragment(): string | undefined {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  return token || undefined;
}

export function VerifyEmailPage({ path }: VerifyEmailPageProps) {
  void path;
  const [token] = useState(readTokenFromFragment);
  const isOnline = useOnlineStatus();
  const verificationMutation = useEmailVerificationMutation();
  const { t } = useI18n();
  const error = verificationMutation.error;
  const errorMessage =
    error instanceof ApiClientError
      ? error.message
      : error
        ? t('auth.verify.error')
        : undefined;

  async function handleVerification() {
    if (!token) return;

    try {
      await verificationMutation.mutateAsync(token);
      window.history.replaceState({}, '', '/verify-email');
    } catch {
      // The mutation state exposes the normalized API error accessibly.
    }
  }

  return (
    <section aria-labelledby="email-verification-title" class="totem-auth-page">
      <div aria-hidden="true" class="totem-auth-email-mark">
        ✉
      </div>
      <header class="totem-auth-page__header">
        <p class="page-eyebrow">{t('auth.verify.step')}</p>
        <h1 class="page-title" id="email-verification-title">
          {t('auth.verify.title')}
        </h1>
        <p>{t('auth.verify.description')}</p>
      </header>
      <OfflineBanner isOffline={!isOnline} message={t('auth.verify.offline')} />
      {verificationMutation.data ? (
        <div class="space-y-5" role="status">
          <h2 class="ui-text text-xl font-semibold">
            {t('auth.verify.successTitle')}
          </h2>
          <p class="ui-text-muted leading-7">
            {t('auth.verify.successDescription')}
          </p>
          <a
            class={actionClassNames('secondary', 'md', 'w-full')}
            href="/login"
          >
            {t('auth.backToLogin')}
          </a>
        </div>
      ) : (
        <div class="space-y-5">
          <p class="ui-text-muted leading-7">{t('auth.verify.explanation')}</p>
          {!token ? (
            <p class="ui-text-danger text-sm" role="alert">
              {t('auth.verify.invalidLink')}
            </p>
          ) : null}
          {errorMessage ? (
            <p class="ui-text-danger text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <Button
            class="w-full"
            disabled={!isOnline || !token}
            isLoading={verificationMutation.isPending}
            onClick={handleVerification}
            type="button"
          >
            {t('auth.verify.submit')}
          </Button>
          <a
            class={actionClassNames('ghost', 'md', 'w-full')}
            href="/request-access"
          >
            {t('auth.verify.requestNewLink')}
          </a>
        </div>
      )}
    </section>
  );
}
