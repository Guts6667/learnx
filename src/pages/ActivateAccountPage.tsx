import { route } from 'preact-router';
import { useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import { useAccessInvitationActivationMutation } from '@/features/auth/access-invitation';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { ApiClientError } from '@/lib/api-client';
import { useI18n } from '@/i18n';

interface ActivateAccountPageProps {
  path?: string;
}

function readTokenFromFragment(): string | undefined {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  return token || undefined;
}

export function ActivateAccountPage({ path }: ActivateAccountPageProps) {
  void path;
  const [token] = useState(readTokenFromFragment);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const isOnline = useOnlineStatus();
  const mutation = useAccessInvitationActivationMutation();
  const { t } = useI18n();
  const requestError =
    mutation.error instanceof ApiClientError
      ? mutation.error.message
      : mutation.error
        ? t('auth.activate.error')
        : undefined;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setValidationError(undefined);
    if (!token) {
      setValidationError(t('auth.activate.invalidInvitation'));
      return;
    }
    if (password !== passwordConfirmation) {
      setValidationError(t('auth.activate.passwordMismatch'));
      return;
    }

    try {
      await mutation.mutateAsync({ displayName, password, token });
      window.history.replaceState({}, '', '/activate');
      route('/today', true);
    } catch {
      // The normalized mutation error is rendered below.
    }
  }

  return (
    <section
      aria-labelledby="activation-title"
      class="totem-auth-page page-shell"
    >
      <PageHeader
        description={t('auth.activate.description')}
        eyebrow={t('auth.activate.eyebrow')}
        id="activation-title"
        title={t('auth.activate.title')}
      />
      <OfflineBanner
        isOffline={!isOnline}
        message={t('auth.activate.offline')}
      />
      <Card>
        <form class="space-y-5" onSubmit={handleSubmit}>
          <TextField
            autoComplete="name"
            label={t('auth.activate.displayName')}
            maxLength={80}
            name="displayName"
            onInput={(event) => setDisplayName(event.currentTarget.value)}
            required
            value={displayName}
          />
          <TextField
            autoComplete="new-password"
            description={t('auth.activate.passwordDescription')}
            label={t('auth.password.label')}
            maxLength={128}
            minLength={12}
            name="password"
            onInput={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
          <TextField
            autoComplete="new-password"
            label={t('auth.activate.passwordConfirmation')}
            maxLength={128}
            minLength={12}
            name="passwordConfirmation"
            onInput={(event) =>
              setPasswordConfirmation(event.currentTarget.value)
            }
            required
            type="password"
            value={passwordConfirmation}
          />
          {!token ? (
            <p class="text-sm text-red-300" role="alert">
              {t('auth.activate.invalidInvitation')}
            </p>
          ) : null}
          {validationError || requestError ? (
            <p class="text-sm text-red-300" role="alert">
              {validationError ?? requestError}
            </p>
          ) : null}
          <Button
            class="w-full"
            disabled={!isOnline || !token}
            isLoading={mutation.isPending}
            type="submit"
          >
            {t('auth.activate.submit')}
          </Button>
        </form>
      </Card>
    </section>
  );
}
