import type { FormEvent } from 'react';
import { useState } from 'react';

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

function mutationError(error: unknown, t: (key: MessageKey) => string): string {
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
    <div className="admin-account-action space-y-3">
      {!isConfirming ? (
        <Button onClick={() => setIsConfirming(true)} variant="secondary">
          {isCreator
            ? t('admin.accounts.creator.remove')
            : t('admin.accounts.creator.assign')}
        </Button>
      ) : (
        <Card className="space-y-3" tone="muted" role="region">
          <h3 className="font-medium">
            {isCreator
              ? t('admin.accounts.learner.confirm')
              : t('admin.accounts.creator.confirm')}
          </h3>
          <p className="ui-text-muted text-sm leading-6">
            {isCreator
              ? t('admin.accounts.learner.description')
              : t('admin.accounts.creator.description')}
          </p>
          <div className="flex flex-wrap gap-3">
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
        <p className="text-sm text-[var(--color-success)]" role="status">
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
    return (
      <div className="admin-account-action">
        <p className="ui-text-muted text-sm">{t('admin.accounts.current')}</p>
      </div>
    );
  }

  return (
    <div className="admin-account-action space-y-3">
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
        <Card className="space-y-3" tone="muted" role="region">
          <h3 className="font-medium">
            {isSuspended
              ? t('admin.accounts.reactivateConfirm')
              : t('admin.accounts.suspendConfirm')}
          </h3>
          <p className="ui-text-muted text-sm leading-6">
            {isSuspended
              ? t('admin.accounts.reactivateDescription')
              : t('admin.accounts.suspendDescription')}
          </p>
          <div className="flex flex-wrap gap-3">
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
        <p className="text-sm text-[var(--color-success)]" role="status">
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
      <div className="admin-collection-item admin-account-row">
        <div className="admin-account-row__summary">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold">
                {account.displayName}
              </h2>
              <p className="ui-text-muted mt-1 break-all text-sm">
                {account.email}
              </p>
            </div>
            <Badge tone={isSuspended ? 'danger' : 'success'}>
              {t(
                isSuspended
                  ? 'admin.accounts.suspended'
                  : 'admin.accounts.active',
              )}
            </Badge>
          </div>
          <p className="ui-text-muted mt-3 text-sm">
            {t('admin.accounts.role', {
              role: t(roleLabels[account.role] as MessageKey),
            })}
          </p>
          {account.suspendedAt ? (
            <p className="ui-text-muted mt-2 text-sm">
              {t('admin.accounts.suspendedAt', {
                date: formatLocalizedDate(account.suspendedAt, locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </p>
          ) : null}
        </div>
        <div className="admin-account-row__actions">
          <AccountRoleAction account={account} />
          <AccountAction
            account={account}
            isCurrentAccount={account.id === currentUserId}
          />
        </div>
      </div>
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section
      aria-labelledby="accounts-title"
      className="page-layout page-layout--admin page-shell space-y-6"
    >
      <PageHeader
        description={t('admin.accounts.description')}
        eyebrow={t('admin.eyebrow')}
        id="accounts-title"
        title={t('admin.accounts.title')}
      />
      <div className="admin-toolbar">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={submitSearch}
        >
          <TextField
            label={t('admin.accounts.search')}
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            type="search"
            value={searchInput}
          />
          <Button className="self-end" type="submit" variant="secondary">
            {t('programs.searchAction')}
          </Button>
        </form>
        <label className="ui-field">
          <span className="ui-field__label">{t('admin.accounts.status')}</span>
          <select
            className="ui-field__control"
            onChange={(event) => {
              setPage(1);
              setStatus(event.currentTarget.value as AccountStatus | '');
            }}
            value={status}
          >
            <option value="">{t('admin.accounts.all')}</option>
            <option value="ACTIVE">{t('admin.accounts.activePlural')}</option>
            <option value="SUSPENDED">
              {t('admin.accounts.suspendedPlural')}
            </option>
          </select>
        </label>
      </div>
      {query.isPending ? (
        <p aria-live="polite">{t('admin.accounts.loading')}</p>
      ) : query.error || !query.data ? (
        <ErrorState
          action={
            <Button onClick={() => void query.retry()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
          description={t('admin.accounts.loadError')}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description={t('admin.accounts.empty.description')}
          title={t('admin.accounts.empty.title')}
        />
      ) : (
        <>
          <p className="ui-text-muted text-sm">
            {t('admin.accounts.count', { count: query.data.total })}
          </p>
          <ul className="admin-collection">
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
            className="flex items-center justify-between gap-4"
          >
            <Button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              variant="secondary"
            >
              {t('admin.accounts.previous')}
            </Button>
            <span className="ui-text-muted text-sm">
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
