import { useState } from 'preact/hooks';

import { actionClassNames } from '@/components/ui/actionStyles';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
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
    <section
      aria-labelledby="email-verification-title"
      class="totem-auth-page page-shell"
    >
      <PageHeader
        description={t('auth.verify.description')}
        eyebrow={t('auth.verify.eyebrow')}
        id="email-verification-title"
        title={t('auth.verify.title')}
      />
      <OfflineBanner isOffline={!isOnline} message={t('auth.verify.offline')} />
      <Card>
        {verificationMutation.data ? (
          <div class="space-y-5" role="status">
            <h2 class="text-xl font-semibold text-white">
              {t('auth.verify.successTitle')}
            </h2>
            <p class="leading-7 text-slate-300">
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
            <p class="leading-7 text-slate-300">
              {t('auth.verify.explanation')}
            </p>
            {!token ? (
              <p class="text-sm text-red-300" role="alert">
                {t('auth.verify.invalidLink')}
              </p>
            ) : null}
            {errorMessage ? (
              <p class="text-sm text-red-300" role="alert">
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
      </Card>
    </section>
  );
}
