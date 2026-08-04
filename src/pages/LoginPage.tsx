import { route } from 'preact-router';
import { useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { ApiClientError } from '@/lib/api-client';
import { useLoginMutation, useSessionQuery } from '@/features/auth/session';
import { useOnlineStatus } from '@/features/pwa/online-status';

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

  useEffect(() => {
    if (sessionQuery.data?.user) {
      route('/today', true);
    }
  }, [sessionQuery.data?.user]);

  if (sessionQuery.isPending) {
    return (
      <section class="mx-auto min-h-48 max-w-xl" aria-live="polite">
        <Skeleton label="Vérification de la session" />
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
        ? 'La connexion a échoué. Réessaie dans quelques instants.'
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
        description="Connecte-toi pour retrouver tes parcours d’apprentissage."
        eyebrow="LearnX"
        id="login-title"
        title="Connexion"
      />
      <OfflineBanner
        isOffline={!isOnline}
        message="Reconnectez-vous pour vérifier votre session et vous connecter."
      />
      <Card>
        <form class="space-y-5" onSubmit={handleSubmit}>
          <TextField
            autoComplete="email"
            label="Adresse e-mail"
            name="email"
            onInput={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
          <TextField
            autoComplete="current-password"
            label="Mot de passe"
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
            Se connecter
          </Button>
        </form>
      </Card>
    </section>
  );
}
