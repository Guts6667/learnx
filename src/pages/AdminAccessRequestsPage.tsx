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
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type AdminAccessRequest,
  type AccessRequestStatus,
  type AssignableRole,
  useAdminAccessRequestReviewMutation,
  useAdminAccessRequestsQuery,
} from '@/features/admin/access-requests';
import { ApiClientError } from '@/lib/api-client';
import type { MessageKey } from '@/i18n/catalogs';

const statusLabelKeys: Record<AccessRequestStatus, MessageKey> = {
  APPROVED: 'admin.requests.approved',
  PENDING_APPROVAL: 'admin.requests.pending',
  REJECTED: 'admin.requests.rejected',
};
const roleLabelKeys: Record<AssignableRole, MessageKey> = {
  ADMIN: 'admin.role.admin',
  CREATOR: 'admin.role.creator',
  USER: 'admin.role.user',
};

function reviewError(error: unknown, t: (key: MessageKey) => string): string {
  if (
    error instanceof ApiClientError &&
    error.code === 'ACCESS_REQUEST_CONFLICT'
  ) {
    return t('admin.requests.conflict');
  }
  return t('admin.requests.mutationError');
}

function RequestReview({ request }: { request: AdminAccessRequest }) {
  const { t } = useI18n();
  const mutation = useAdminAccessRequestReviewMutation();
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>();
  const [confirmation, setConfirmation] = useState(false);
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<AssignableRole>('USER');
  const [success, setSuccess] = useState<string>();

  async function resendInvitation() {
    setSuccess(undefined);
    try {
      await mutation.resend(request.id, {
        expectedVersion: request.version,
      });
      setSuccess(t('admin.requests.resendSuccess'));
    } catch {
      // The normalized mutation error is announced below.
    }
  }

  async function applyDecision() {
    setSuccess(undefined);
    try {
      if (action === 'APPROVE') {
        await mutation.approve(request.id, {
          expectedVersion: request.version,
          role,
        });
        setSuccess(t('admin.requests.approveSuccess'));
      } else if (action === 'REJECT') {
        await mutation.reject(request.id, {
          expectedVersion: request.version,
          reason: reason.trim(),
        });
        setSuccess(t('admin.requests.rejectSuccess'));
      }
      setAction(undefined);
      setConfirmation(false);
    } catch {
      // The normalized mutation error is announced below.
    }
  }

  if (request.status !== 'PENDING_APPROVAL') {
    return (
      <div className="ui-text-muted space-y-2 text-sm">
        {request.assignedRole ? (
          <p>
            {t('admin.requests.assignedRole', {
              role: t(roleLabelKeys[request.assignedRole]),
            })}
          </p>
        ) : null}
        {request.rejectionReason ? (
          <p>
            {t('admin.requests.internalReason', {
              reason: request.rejectionReason,
            })}
          </p>
        ) : null}
        {request.status === 'APPROVED' ? (
          <Button
            isLoading={mutation.isPending}
            onClick={() => void resendInvitation()}
            variant="secondary"
          >
            {t('admin.requests.resend')}
          </Button>
        ) : null}
        {success ? (
          <p className="text-sm text-[var(--color-success)]" role="status">
            {success}
          </p>
        ) : null}
        {mutation.error ? (
          <ErrorState description={reviewError(mutation.error, t)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!action ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => setAction('APPROVE')}>
            {t('admin.requests.accept')}
          </Button>
          <Button onClick={() => setAction('REJECT')} variant="secondary">
            {t('admin.requests.reject')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          {action === 'APPROVE' ? (
            <label className="ui-field">
              {t('admin.requests.role')}
              <select
                className="ui-field__control"
                onChange={(event) =>
                  setRole(event.currentTarget.value as AssignableRole)
                }
                value={role}
              >
                {Object.entries(roleLabelKeys).map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Textarea
              description={t('admin.requests.reasonHelp')}
              label={t('admin.requests.reason')}
              maxLength={2_000}
              onInput={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
          )}
          {!confirmation ? (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={action === 'REJECT' && !reason.trim()}
                onClick={() => setConfirmation(true)}
                variant={action === 'APPROVE' ? 'primary' : 'danger'}
              >
                {t('admin.requests.previewDecision')}
              </Button>
              <Button onClick={() => setAction(undefined)} variant="ghost">
                {t('admin.accounts.cancel')}
              </Button>
            </div>
          ) : (
            <Card className="space-y-3" tone="muted" role="region">
              <h3 className="font-medium">
                {t('admin.requests.confirmDecision')}
              </h3>
              <p className="ui-text-muted text-sm leading-6">
                {action === 'APPROVE'
                  ? t('admin.requests.approvePreview', {
                      role: t(roleLabelKeys[role]),
                    })
                  : t('admin.requests.rejectPreview', {
                      reason: reason.trim(),
                    })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  isLoading={mutation.isPending}
                  onClick={() => void applyDecision()}
                  variant={action === 'APPROVE' ? 'primary' : 'danger'}
                >
                  {t('admin.accounts.confirm')}
                </Button>
                <Button onClick={() => setConfirmation(false)} variant="ghost">
                  {t('admin.requests.edit')}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
      {success ? (
        <p className="text-sm text-[var(--color-success)]" role="status">
          {success}
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={reviewError(mutation.error, t)} />
      ) : null}
    </div>
  );
}

function RequestCard({ request }: { request: AdminAccessRequest }) {
  const { locale, t } = useI18n();
  const tone =
    request.status === 'APPROVED'
      ? 'success'
      : request.status === 'REJECTED'
        ? 'danger'
        : 'warning';

  return (
    <li>
      <div className="admin-collection-item space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold">
              {request.emailNormalized}
            </h2>
            <p className="ui-text-muted mt-1 text-sm">
              {t('admin.requests.verifiedAt', {
                date: formatLocalizedDate(request.emailVerifiedAt, locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </p>
          </div>
          <Badge tone={tone}>{t(statusLabelKeys[request.status])}</Badge>
        </div>
        <RequestReview request={request} />
      </div>
    </li>
  );
}

export function AdminAccessRequestsPage() {
  useBackNavigationTarget({
    href: '/admin',
    labelKey: 'navigation.back.admin',
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<AccessRequestStatus>('PENDING_APPROVAL');
  const query = useAdminAccessRequestsQuery({
    page,
    pageSize: 20,
    search,
    status,
  });
  const { t } = useI18n();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section
      aria-labelledby="access-review-title"
      className="page-layout page-layout--admin page-shell space-y-6"
    >
      <PageHeader
        description={t('admin.requests.description')}
        eyebrow={t('admin.eyebrow')}
        id="access-review-title"
        title={t('admin.requests.title')}
      />
      <div className="admin-toolbar">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={submitSearch}
        >
          <TextField
            label={t('admin.requests.search')}
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            type="search"
            value={searchInput}
          />
          <Button className="self-end" type="submit" variant="secondary">
            {t('programs.searchAction')}
          </Button>
        </form>
        <label className="ui-field">
          <span className="ui-field__label">{t('admin.requests.status')}</span>
          <select
            className="ui-field__control"
            onChange={(event) => {
              setPage(1);
              setStatus(event.currentTarget.value as AccessRequestStatus);
            }}
            value={status}
          >
            {Object.entries(statusLabelKeys).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <p aria-live="polite">{t('admin.requests.loading')}</p>
      ) : query.error || !query.data ? (
        <ErrorState
          action={
            <Button onClick={() => void query.retry()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
          description={t('admin.requests.loadError')}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description={t('admin.requests.empty.description')}
          title={t('admin.requests.empty.title')}
        />
      ) : (
        <>
          <p className="ui-text-muted text-sm">
            {t('admin.requests.count', { count: query.data.total })}
          </p>
          <ul className="admin-collection">
            {query.data.items.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </ul>
          <nav
            aria-label={t('admin.requests.pagination')}
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
