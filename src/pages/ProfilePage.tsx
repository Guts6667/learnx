import { route } from 'preact-router';

import { Button } from '@/components/ui/Button';
import { useLogoutMutation, useSessionQuery } from '@/features/auth/session';

export function ProfilePage() {
  const sessionQuery = useSessionQuery();
  const logoutMutation = useLogoutMutation();
  const user = sessionQuery.data?.user;

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
      route('/login', true);
    } catch {
      // Keep the session query unchanged when the server cannot confirm logout.
    }
  }

  if (!user) {
    return null;
  }

  return (
    <section aria-labelledby="profile-title">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
        Compte
      </p>
      <h1 id="profile-title" class="mt-3 text-3xl font-bold tracking-tight">
        {user.displayName}
      </h1>
      <p class="mt-4 text-base text-slate-300">{user.email}</p>
      {user.role === 'ADMIN' ? (
        <a
          class="mt-6 inline-flex min-h-11 items-center text-cyan-300 underline"
          href="/admin"
        >
          Ouvrir l’administration
        </a>
      ) : null}
      <Button
        class="mt-8 block"
        isLoading={logoutMutation.isPending}
        onClick={handleLogout}
        variant="secondary"
      >
        Se déconnecter
      </Button>
    </section>
  );
}
