import { useState } from 'preact/hooks';

import { actionClassNames } from '@/components/ui/actionStyles';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { useEmailVerificationMutation } from '@/features/auth/access-request';
import { useOnlineStatus } from '@/features/pwa/online-status';
import { ApiClientError } from '@/lib/api-client';

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
  const error = verificationMutation.error;
  const errorMessage =
    error instanceof ApiClientError
      ? error.message
      : error
        ? 'La vérification a échoué. Demande un nouveau lien puis réessaie.'
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
      class="page-shell mx-auto max-w-xl"
    >
      <PageHeader
        description="Confirme ton adresse pour transmettre ta demande à l’administrateur LearnX."
        eyebrow="Demande d’accès"
        id="email-verification-title"
        title="Vérifier mon adresse e-mail"
      />
      <OfflineBanner
        isOffline={!isOnline}
        message="Reconnectez-vous pour vérifier votre adresse e-mail."
      />
      <Card>
        {verificationMutation.data ? (
          <div class="space-y-5" role="status">
            <h2 class="text-xl font-semibold text-white">Adresse vérifiée</h2>
            <p class="leading-7 text-slate-300">
              {verificationMutation.data.message}
            </p>
            <a
              class={actionClassNames('secondary', 'md', 'w-full')}
              href="/login"
            >
              Revenir à la connexion
            </a>
          </div>
        ) : (
          <div class="space-y-5">
            <p class="leading-7 text-slate-300">
              Cette confirmation ne crée pas encore de compte. Après validation,
              ta demande devra être approuvée par un administrateur.
            </p>
            {!token ? (
              <p class="text-sm text-red-300" role="alert">
                Ce lien de vérification est invalide ou incomplet.
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
              Vérifier mon adresse
            </Button>
            <a
              class={actionClassNames('ghost', 'md', 'w-full')}
              href="/request-access"
            >
              Demander un nouveau lien
            </a>
          </div>
        )}
      </Card>
    </section>
  );
}
