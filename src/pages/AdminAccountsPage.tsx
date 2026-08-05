import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import {
  type AccountStatus,
  type AdminAccount,
  useAdminAccountsQuery,
  useAdminAccountStatusMutation,
} from '@/features/admin/accounts';
import { useSessionQuery } from '@/features/auth/session';
import { ApiClientError } from '@/lib/api-client';

const roleLabels = {
  ADMIN: 'Administrateur',
  CREATOR: 'Créateur',
  USER: 'Apprenant',
} as const;

function mutationError(error: unknown): string {
  if (error instanceof ApiClientError && error.code === 'ACCOUNT_STATE_CONFLICT') {
    return 'Le statut du compte a changé. Rechargez la liste avant de réessayer.';
  }
  if (
    error instanceof ApiClientError &&
    error.code === 'SELF_SUSPENSION_NOT_ALLOWED'
  ) {
    return 'Vous ne pouvez pas suspendre votre propre compte.';
  }

  return 'Le statut du compte n’a pas pu être modifié.';
}

function AccountAction({
  account,
  isCurrentAccount,
}: {
  account: AdminAccount;
  isCurrentAccount: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [success, setSuccess] = useState<string>();
  const mutation = useAdminAccountStatusMutation();
  const isSuspended = account.accountStatus === 'SUSPENDED';
  const action = isSuspended ? 'reactivate' : 'suspend';

  async function confirm() {
    setSuccess(undefined);
    try {
      await mutation.execute(account, action);
      setSuccess(
        isSuspended
          ? 'Compte réactivé. Une nouvelle connexion sera nécessaire.'
          : 'Compte suspendu et toutes ses sessions ont été révoquées.',
      );
      setIsConfirming(false);
    } catch {
      // The normalized mutation error is announced below.
    }
  }

  if (isCurrentAccount) {
    return <p class="text-sm text-slate-400">Compte administrateur courant</p>;
  }

  return (
    <div class="space-y-3 border-t border-slate-700 pt-4">
      {!isConfirming ? (
        <Button
          onClick={() => setIsConfirming(true)}
          variant={isSuspended ? 'secondary' : 'danger'}
        >
          {isSuspended ? 'Réactiver le compte' : 'Suspendre le compte'}
        </Button>
      ) : (
        <Card class="space-y-3 bg-slate-950" role="region">
          <h3 class="font-semibold">
            {isSuspended
              ? 'Confirmer la réactivation'
              : 'Confirmer la suspension'}
          </h3>
          <p class="text-sm leading-6 text-slate-300">
            {isSuspended
              ? 'Le compte pourra de nouveau se connecter. Aucune ancienne session ne sera restaurée.'
              : 'Toutes les sessions seront immédiatement révoquées. Les notes, progressions, tentatives et soumissions seront conservées.'}
          </p>
          <div class="flex flex-wrap gap-3">
            <Button
              isLoading={mutation.isPending}
              onClick={() => void confirm()}
              variant={isSuspended ? 'primary' : 'danger'}
            >
              Confirmer
            </Button>
            <Button onClick={() => setIsConfirming(false)} variant="ghost">
              Annuler
            </Button>
          </div>
        </Card>
      )}
      {success ? (
        <p class="text-sm text-emerald-200" role="status">
          {success}
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={mutationError(mutation.error)} />
      ) : null}
    </div>
  );
}

function AccountCard({
  account,
  currentUserId,
}: {
  account: AdminAccount;
  currentUserId?: string;
}) {
  const isSuspended = account.accountStatus === 'SUSPENDED';

  return (
    <li>
      <Card class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="break-words text-lg font-semibold">
              {account.displayName}
            </h2>
            <p class="mt-1 break-all text-sm text-slate-300">
              {account.email}
            </p>
          </div>
          <Badge tone={isSuspended ? 'danger' : 'success'}>
            {isSuspended ? 'Suspendu' : 'Actif'}
          </Badge>
        </div>
        <p class="text-sm text-slate-400">
          Rôle : {roleLabels[account.role]}
        </p>
        {account.suspendedAt ? (
          <p class="text-sm text-slate-400">
            Suspendu le{' '}
            {new Intl.DateTimeFormat('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(account.suspendedAt))}
          </p>
        ) : null}
        <AccountAction
          account={account}
          isCurrentAccount={account.id === currentUserId}
        />
      </Card>
    </li>
  );
}

export function AdminAccountsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const sessionQuery = useSessionQuery();
  const query = useAdminAccountsQuery({
    page,
    pageSize: 20,
    search,
    status: status || undefined,
  });

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section aria-labelledby="accounts-title" class="page-shell space-y-6">
      <a
        class="inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        href="/admin"
      >
        Retour à l’administration
      </a>
      <PageHeader
        description="Suspendez ou réactivez les comptes sans supprimer leurs données personnelles d’apprentissage."
        eyebrow="Zone sécurisée"
        id="accounts-title"
        title="Comptes utilisateurs"
      />
      <form class="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={submitSearch}>
        <TextField
          label="Rechercher un compte"
          onInput={(event) => setSearchInput(event.currentTarget.value)}
          type="search"
          value={searchInput}
        />
        <Button class="self-end" type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        Statut du compte
        <select
          class="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          onChange={(event) => {
            setPage(1);
            setStatus(event.currentTarget.value as AccountStatus | '');
          }}
          value={status}
        >
          <option value="">Tous les comptes</option>
          <option value="ACTIVE">Actifs</option>
          <option value="SUSPENDED">Suspendus</option>
        </select>
      </label>
      {query.isPending ? (
        <p aria-live="polite">Chargement des comptes…</p>
      ) : query.error || !query.data ? (
        <ErrorState description="Les comptes n’ont pas pu être chargés." />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description="Aucun compte ne correspond à ces filtres."
          title="Aucun compte"
        />
      ) : (
        <>
          <p class="text-sm text-slate-400">
            {query.data.total} compte{query.data.total > 1 ? 's' : ''}
          </p>
          <ul class="space-y-4">
            {query.data.items.map((account) => (
              <AccountCard
                account={account}
                currentUserId={sessionQuery.data?.user?.id}
                key={account.id}
              />
            ))}
          </ul>
          <nav
            aria-label="Pagination des comptes"
            class="flex items-center justify-between gap-4"
          >
            <Button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              variant="secondary"
            >
              Précédent
            </Button>
            <span class="text-sm text-slate-300">
              Page {query.data.page} sur {query.data.totalPages}
            </span>
            <Button
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((value) => value + 1)}
              variant="secondary"
            >
              Suivant
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
