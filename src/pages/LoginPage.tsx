import { route } from 'preact-router';
import { useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { ApiClientError } from '@/lib/api-client';
import { useLoginMutation, useSessionQuery } from '@/features/auth/session';

interface LoginPageProps {
  path?: string;
}

export function LoginPage({ path }: LoginPageProps) {
  void path;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLoginMutation();
  const sessionQuery = useSessionQuery();

  useEffect(() => {
    if (sessionQuery.data?.user) {
      route('/today', true);
    }
  }, [sessionQuery.data?.user]);

  if (sessionQuery.isPending) {
    return (
      <section
        class="flex min-h-48 items-center justify-center"
        aria-live="polite"
      >
        <Spinner label="Vérification de la session" />
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
    <section aria-labelledby="login-title">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
        LearnX
      </p>
      <h1 id="login-title" class="mt-3 text-3xl font-bold tracking-tight">
        Connexion
      </h1>
      <p class="mt-4 text-base leading-7 text-slate-300">
        Connecte-toi pour retrouver tes parcours d’apprentissage.
      </p>
      <form class="mt-8 space-y-5" onSubmit={handleSubmit}>
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
          isLoading={loginMutation.isPending}
          type="submit"
        >
          Se connecter
        </Button>
      </form>
    </section>
  );
}
