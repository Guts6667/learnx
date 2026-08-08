import { route } from 'preact-router';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLogoutMutation, useSessionQuery } from '@/features/auth/session';
import { PwaInstallSettings } from '@/features/pwa/PwaStatus';

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
      <Card class="max-w-2xl">
        <div class="min-w-0">
          <p class="text-sm text-slate-400">Adresse e-mail</p>
          <p class="mt-1 break-all text-base text-slate-100">{user.email}</p>
        </div>
        <div
          aria-labelledby="profile-actions-title"
          class="mt-6 space-y-3 border-t border-slate-800 pt-5"
        >
          <h2
            class="text-sm font-semibold text-slate-300"
            id="profile-actions-title"
          >
            Actions
          </h2>
          <div class="flex w-full min-w-0 flex-col gap-3">
            {user.role === 'ADMIN' ? (
              <NavigationAction
                class="w-full min-w-0 text-center"
                href="/admin"
                variant="secondary"
              >
                Ouvrir l’administration
              </NavigationAction>
            ) : null}
            <Button
              class="w-full min-w-0"
              isLoading={logoutMutation.isPending}
              onClick={handleLogout}
              variant="ghost"
            >
              Se déconnecter
            </Button>
          </div>
        </div>
      </Card>
      <PwaInstallSettings />
    </section>
  );
}
