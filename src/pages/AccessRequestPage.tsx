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

interface AccessRequestPageProps {
  path?: string;
}

export function AccessRequestPage({ path }: AccessRequestPageProps) {
  void path;
  const [email, setEmail] = useState('');
  const isOnline = useOnlineStatus();
  const requestMutation = useAccessRequestMutation();
  const error = requestMutation.error;
  const errorMessage =
    error instanceof ApiClientError
      ? error.message
      : error
        ? 'La demande n’a pas pu être enregistrée. Réessaie dans quelques instants.'
        : undefined;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    try {
      await requestMutation.mutateAsync(email);
    } catch {
      // The mutation state exposes the normalized API error accessibly.
    }
  }

  return (
    <section
      aria-labelledby="access-request-title"
      class="page-shell mx-auto max-w-xl"
    >
      <PageHeader
        description="Indique ton adresse e-mail pour demander l’accès à LearnX. Aucun mot de passe n’est nécessaire à cette étape."
        eyebrow="LearnX"
        id="access-request-title"
        title="Demander un accès"
      />
      <OfflineBanner
        isOffline={!isOnline}
        message="Reconnectez-vous pour envoyer votre demande d’accès."
      />
      <Card>
        {requestMutation.data ? (
          <div class="space-y-5" role="status">
            <h2 class="text-xl font-semibold text-white">
              Demande enregistrée
            </h2>
            <p class="leading-7 text-slate-300">
              {requestMutation.data.message}
            </p>
            <a
              class={actionClassNames('secondary', 'md', 'w-full')}
              href="/login"
            >
              Revenir à la connexion
            </a>
          </div>
        ) : (
          <form class="space-y-5" onSubmit={handleSubmit}>
            <TextField
              autoComplete="email"
              description="Nous utiliserons cette adresse uniquement pour le suivi de ta demande."
              label="Adresse e-mail"
              name="email"
              onInput={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
            {errorMessage ? (
              <p class="text-sm text-red-300" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <Button
              class="w-full"
              disabled={!isOnline}
              isLoading={requestMutation.isPending}
              type="submit"
            >
              Envoyer ma demande
            </Button>
            <a class={actionClassNames('ghost', 'md', 'w-full')} href="/login">
              J’ai déjà un compte
            </a>
          </form>
        )}
      </Card>
    </section>
  );
}
