import { useState } from 'preact/hooks';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { useI18n } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';
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
  useAdminAccountRoleMutation,
  useAdminAccountStatusMutation,
} from '@/features/admin/accounts';
import { useSessionQuery } from '@/features/auth/session';
import { ApiClientError } from '@/lib/api-client';
import type { MessageKey } from '@/i18n/catalogs';

const roleLabels = {
  ADMIN: 'admin.role.admin',
  CREATOR: 'admin.role.creator',
  USER: 'admin.role.user',
} as const;

function mutationError(
  error: unknown,
  t: (key: MessageKey) => string,
): string {
  if (
    error instanceof ApiClientError &&
    error.code === 'ACCOUNT_STATE_CONFLICT'
  ) {
    return t('admin.accounts.changed');
  }
  if (
    error instanceof ApiClientError &&
    error.code === 'SELF_SUSPENSION_NOT_ALLOWED'
  ) {
    return t('admin.accounts.selfSuspend');
  }

  return t('admin.accounts.mutationError');
}

function AccountRoleAction({ account }: { account: AdminAccount }) {
  const { t } = useI18n();
  const [isConfirming, setIsConfirming] = useState(false);
  const [success, setSuccess] = useState<string>();
  const mutation = useAdminAccountRoleMutation();

  if (account.role === 'ADMIN') return null;

  const isCreator = account.role === 'CREATOR';
  const nextRole = isCreator ? 'USER' : 'CREATOR';

  async function confirm() {
    setSuccess(undefined);
    try {
      await mutation.execute(account, nextRole);
      setSuccess(
        t(
          isCreator
            ? 'admin.accounts.learner.success'
            : 'admin.accounts.creator.success',
        ),
      );
      setIsConfirming(false);
    } catch {
      // The normalized mutation error is announced below.
    }
  }

  return (
    <div class="space-y-3 border-t border-slate-700 pt-4">
      {!isConfirming ? (
        <Button onClick={() => setIsConfirming(true)} variant="secondary">
          {isCreator
            ? t('admin.accounts.creator.remove')
            : t('admin.accounts.creator.assign')}
        </Button>
      ) : (
        <Card class="space-y-3 bg-slate-950" role="region">
          <h3 class="font-semibold">
            {isCreator
              ? t('admin.accounts.learner.confirm')
              : t('admin.accounts.creator.confirm')}
          </h3>
          <p class="text-sm leading-6 text-slate-300">
            {isCreator
              ? t('admin.accounts.learner.description')
              : t('admin.accounts.creator.description')}
          </p>
          <div class="flex flex-wrap gap-3">
            <Button
              isLoading={mutation.isPending}
              onClick={() => void confirm()}
            >
              {t('admin.accounts.confirm')}
            </Button>
            <Button onClick={() => setIsConfirming(false)} variant="ghost">
              {t('admin.accounts.cancel')}
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
        <ErrorState description={mutationError(mutation.error, t)} />
      ) : null}
    </div>
  );
}

function AccountAction({
  account,
  isCurrentAccount,
}: {
  account: AdminAccount;
  isCurrentAccount: boolean;
}) {
  const { t } = useI18n();
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
        t(
          isSuspended
            ? 'admin.accounts.reactivateSuccess'
            : 'admin.accounts.suspendSuccess',
        ),
      );
      setIsConfirming(false);
    } catch {
      // The normalized mutation error is announced below.
    }
  }

  if (isCurrentAccount) {
    return <p class="text-sm text-slate-400">{t('admin.accounts.current')}</p>;
  }

  return (
    <div class="space-y-3 border-t border-slate-700 pt-4">
      {!isConfirming ? (
        <Button
          onClick={() => setIsConfirming(true)}
          variant={isSuspended ? 'secondary' : 'danger'}
        >
          {t(
            isSuspended
              ? 'admin.accounts.reactivate'
              : 'admin.accounts.suspend',
          )}
        </Button>
      ) : (
        <Card class="space-y-3 bg-slate-950" role="region">
          <h3 class="font-semibold">
            {isSuspended
              ? t('admin.accounts.reactivateConfirm')
              : t('admin.accounts.suspendConfirm')}
          </h3>
          <p class="text-sm leading-6 text-slate-300">
            {isSuspended
              ? t('admin.accounts.reactivateDescription')
              : t('admin.accounts.suspendDescription')}
          </p>
          <div class="flex flex-wrap gap-3">
            <Button
              isLoading={mutation.isPending}
              onClick={() => void confirm()}
              variant={isSuspended ? 'primary' : 'danger'}
            >
              {t('admin.accounts.confirm')}
            </Button>
            <Button onClick={() => setIsConfirming(false)} variant="ghost">
              {t('admin.accounts.cancel')}
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
        <ErrorState description={mutationError(mutation.error, t)} />
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
  const { locale, t } = useI18n();
  const isSuspended = account.accountStatus === 'SUSPENDED';

  return (
    <li>
      <Card class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="break-words text-lg font-semibold">
              {account.displayName}
            </h2>
            <p class="mt-1 break-all text-sm text-slate-300">{account.email}</p>
          </div>
          <Badge tone={isSuspended ? 'danger' : 'success'}>
            {t(
              isSuspended
                ? 'admin.accounts.suspended'
                : 'admin.accounts.active',
            )}
          </Badge>
        </div>
        <p class="text-sm text-slate-400">
          {t('admin.accounts.role', { role: t(roleLabels[account.role] as MessageKey) })}
        </p>
        {account.suspendedAt ? (
          <p class="text-sm text-slate-400">
            {t('admin.accounts.suspendedAt', {
              date: formatLocalizedDate(account.suspendedAt, locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </p>
        ) : null}
        <AccountRoleAction account={account} />
        <AccountAction
          account={account}
          isCurrentAccount={account.id === currentUserId}
        />
      </Card>
    </li>
  );
}

export function AdminAccountsPage() {
  useBackNavigationTarget({
    href: '/admin',
    labelKey: 'navigation.back.admin',
  });
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
  const { t } = useI18n();

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
        {t('navigation.back.admin')}
      </a>
      <PageHeader
        description={t('admin.accounts.description')}
        eyebrow={t('admin.eyebrow')}
        id="accounts-title"
        title={t('admin.accounts.title')}
      />
      <form class="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={submitSearch}>
        <TextField
          label={t('admin.accounts.search')}
          onInput={(event) => setSearchInput(event.currentTarget.value)}
          type="search"
          value={searchInput}
        />
        <Button class="self-end" type="submit" variant="secondary">
          {t('programs.searchAction')}
        </Button>
      </form>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        {t('admin.accounts.status')}
        <select
          class="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          onChange={(event) => {
            setPage(1);
            setStatus(event.currentTarget.value as AccountStatus | '');
          }}
          value={status}
        >
          <option value="">{t('admin.accounts.all')}</option>
          <option value="ACTIVE">{t('admin.accounts.activePlural')}</option>
          <option value="SUSPENDED">{t('admin.accounts.suspendedPlural')}</option>
        </select>
      </label>
      {query.isPending ? (
        <p aria-live="polite">{t('admin.accounts.loading')}</p>
      ) : query.error || !query.data ? (
        <ErrorState description={t('admin.accounts.loadError')} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description={t('admin.accounts.empty.description')}
          title={t('admin.accounts.empty.title')}
        />
      ) : (
        <>
          <p class="text-sm text-slate-400">
            {t('admin.accounts.count', { count: query.data.total })}
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
            aria-label={t('admin.accounts.pagination')}
            class="flex items-center justify-between gap-4"
          >
            <Button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              variant="secondary"
            >
              {t('admin.accounts.previous')}
            </Button>
            <span class="text-sm text-slate-300">
              {t('admin.accounts.page', {
                page: query.data.page,
                total: query.data.totalPages,
              })}
            </span>
            <Button
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((value) => value + 1)}
              variant="secondary"
            >
              {t('admin.accounts.next')}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
