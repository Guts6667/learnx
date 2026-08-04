import { route } from 'preact-router';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
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
    <section aria-labelledby="profile-title" class="page-shell">
      <PageHeader
        eyebrow="Compte"
        id="profile-title"
        title={user.displayName}
      />
      <Card class="max-w-2xl space-y-5">
        <div>
          <p class="text-sm text-slate-400">Adresse e-mail</p>
          <p class="mt-1 break-all text-base text-slate-100">{user.email}</p>
        </div>
        {user.role === 'ADMIN' ? (
          <a
            class="inline-flex min-h-11 items-center text-cyan-300 underline"
            href="/admin"
          >
            Ouvrir l’administration
          </a>
        ) : null}
        <Button
          isLoading={logoutMutation.isPending}
          onClick={handleLogout}
          variant="secondary"
        >
          Se déconnecter
        </Button>
      </Card>
    </section>
  );
}
