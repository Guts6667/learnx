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
  const requestError =
    mutation.error instanceof ApiClientError
      ? mutation.error.message
      : mutation.error
        ? 'L’activation a échoué. Réessaie dans quelques instants.'
        : undefined;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setValidationError(undefined);
    if (!token) {
      setValidationError('Cette invitation est invalide ou incomplète.');
      return;
    }
    if (password !== passwordConfirmation) {
      setValidationError('Les deux mots de passe doivent être identiques.');
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
    <section aria-labelledby="activation-title" class="page-shell mx-auto max-w-xl">
      <PageHeader
        description="Choisis tes informations de connexion pour finaliser ton accès à LearnX."
        eyebrow="Invitation acceptée"
        id="activation-title"
        title="Activer mon compte"
      />
      <OfflineBanner
        isOffline={!isOnline}
        message="Reconnectez-vous pour activer votre compte."
      />
      <Card>
        <form class="space-y-5" onSubmit={handleSubmit}>
          <TextField
            autoComplete="name"
            label="Nom affiché"
            maxLength={80}
            name="displayName"
            onInput={(event) => setDisplayName(event.currentTarget.value)}
            required
            value={displayName}
          />
          <TextField
            autoComplete="new-password"
            description="Utilise entre 12 et 128 caractères."
            label="Mot de passe"
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
            label="Confirmer le mot de passe"
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
              Cette invitation est invalide ou incomplète.
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
            Activer mon compte
          </Button>
        </form>
      </Card>
    </section>
  );
}
