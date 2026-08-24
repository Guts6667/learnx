import { useState } from 'preact/hooks';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type CreditMemberSummary,
  useAdminCreditAdjustmentMutation,
  useAdminCreditMemberQuery,
  useAdminCreditMembersQuery,
  useAdminCreditPoliciesQuery,
} from '@/features/credits/credits';
import { useI18n } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

function value(amount: string, locale: 'en' | 'fr'): string {
  return BigInt(amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');
}

function MemberRow({
  isSelected,
  member,
  onAdjust,
}: {
  isSelected: boolean;
  member: CreditMemberSummary;
  onAdjust: (member: CreditMemberSummary) => void;
}) {
  const { locale, t } = useI18n();
  return (
    <li class="admin-credit-member-row">
      <div>
        <h2 class="font-medium">{member.displayName}</h2>
        <p class="ui-text-muted mt-1 break-all text-sm">{member.email}</p>
      </div>
      <div>
        <span class="admin-credit-label">{t('credits.free')}</span>
        <strong>{value(member.projection.free.available, locale)}</strong>
      </div>
      <div>
        <span class="admin-credit-label">{t('credits.purchased')}</span>
        <strong>{value(member.projection.purchased.available, locale)}</strong>
      </div>
      <Badge tone={member.accountStatus === 'ACTIVE' ? 'success' : 'warning'}>
        {t(
          member.accountStatus === 'ACTIVE'
            ? 'admin.accounts.active'
            : 'admin.accounts.suspended',
        )}
      </Badge>
      <Button
        aria-expanded={isSelected}
        aria-haspopup="dialog"
        onClick={() => onAdjust(member)}
        variant="secondary"
      >
        {t('admin.credits.adjust')}
      </Button>
    </li>
  );
}

function AdjustmentDrawer({
  member,
  onDismiss,
}: {
  member: CreditMemberSummary | null;
  onDismiss: () => void;
}) {
  const { locale, t } = useI18n();
  const detail = useAdminCreditMemberQuery(member?.userId);
  const mutation = useAdminCreditAdjustmentMutation();
  const [operation, setOperation] = useState<'GRANT' | 'REDUCE'>('GRANT');
  const [amount, setAmount] = useState('');
  const [compensatesEntryId, setCompensatesEntryId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'EDIT' | 'REVIEW'>('EDIT');

  async function confirm() {
    if (!member) return;
    await mutation.execute(member.userId, {
      amount: operation === 'REDUCE' ? `-${amount}` : amount,
      compensatesEntryId:
        operation === 'REDUCE' ? compensatesEntryId : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      reason,
    });
    onDismiss();
  }

  return (
    <Drawer
      isOpen={Boolean(member)}
      onDismiss={onDismiss}
      title={t('admin.credits.adjustTitle')}
    >
      {member ? (
        <div class="space-y-6">
          <div>
            <p class="font-medium">{member.displayName}</p>
            <p class="ui-text-muted mt-1 text-sm">{member.email}</p>
          </div>
          {detail.isPending ? <Skeleton class="h-48" /> : null}
          {detail.error ? (
            <ErrorState description={t('admin.credits.memberError')} />
          ) : null}
          {detail.data ? (
            <div class="credit-admin-current">
              <div>
                <span>{t('credits.free')}</span>
                <strong>
                  {value(detail.data.projection.free.available, locale)}
                </strong>
              </div>
              <div>
                <span>{t('credits.purchased')}</span>
                <strong>
                  {value(detail.data.projection.purchased.available, locale)}
                </strong>
              </div>
            </div>
          ) : null}
          {step === 'EDIT' ? (
            <form
              class="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setStep('REVIEW');
              }}
            >
              <TextField
                description={t('admin.credits.amountDescription')}
                inputMode="numeric"
                label={t('admin.credits.amount')}
                onInput={(event) => setAmount(event.currentTarget.value)}
                pattern="[1-9][0-9]*"
                required
                value={amount}
              />
              <label class="ui-field">
                <span class="ui-field__label">{t('admin.credits.operation')}</span>
                <select
                  class="ui-field__control"
                  onInput={(event) => {
                    const next = event.currentTarget.value as 'GRANT' | 'REDUCE';
                    setOperation(next);
                    setCompensatesEntryId('');
                  }}
                  value={operation}
                >
                  <option value="GRANT">{t('admin.credits.operationGrant')}</option>
                  <option value="REDUCE">{t('admin.credits.operationReduce')}</option>
                </select>
              </label>
              {operation === 'GRANT' ? (
                <TextField
                  description={t('admin.credits.expirationDescription')}
                  label={t('admin.credits.expiration')}
                  onInput={(event) => setExpiresAt(event.currentTarget.value)}
                  type="datetime-local"
                  value={expiresAt}
                />
              ) : (
                <label class="ui-field">
                  <span class="ui-field__label">{t('admin.credits.compensates')}</span>
                  <select
                    class="ui-field__control"
                    onInput={(event) => setCompensatesEntryId(event.currentTarget.value)}
                    required
                    value={compensatesEntryId}
                  >
                    <option value="">{t('admin.credits.compensatesPlaceholder')}</option>
                    {detail.data?.history
                      .filter(
                        (entry) =>
                          entry.provenance === 'FREE_ALLOCATION' &&
                          BigInt(entry.amount) > 0n,
                      )
                      .map((entry) => (
                        <option key={entry.entryId} value={entry.entryId}>
                          {value(entry.amount, locale)} ·{' '}
                          {formatLocalizedDate(entry.createdAt, locale, {
                            dateStyle: 'medium',
                          })}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <Textarea
                label={t('admin.credits.reason')}
                maxLength={500}
                minLength={8}
                onInput={(event) => setReason(event.currentTarget.value)}
                required
                value={reason}
              />
              <Button
                disabled={
                  !amount ||
                  reason.trim().length < 8 ||
                  (operation === 'REDUCE' && !compensatesEntryId)
                }
              >
                {t('admin.credits.review')}
              </Button>
            </form>
          ) : (
            <section aria-labelledby="credit-adjustment-summary" class="space-y-4">
              <h3 class="text-xl font-medium" id="credit-adjustment-summary">
                {t('admin.credits.summary')}
              </h3>
              <dl class="credit-adjustment-summary">
                <div>
                  <dt>{t('admin.credits.amount')}</dt>
                  <dd>{value(operation === 'REDUCE' ? `-${amount}` : amount, locale)}</dd>
                </div>
                {operation === 'GRANT' ? (
                  <div>
                    <dt>{t('admin.credits.expiration')}</dt>
                    <dd>
                      {expiresAt
                        ? formatLocalizedDate(new Date(expiresAt).toISOString(), locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : t('admin.credits.noExpiration')}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('admin.credits.reason')}</dt>
                  <dd>{reason}</dd>
                </div>
              </dl>
              <p class="ui-text-muted text-sm leading-6">
                {t('admin.credits.summaryNotice')}
              </p>
              <div class="flex flex-wrap gap-3">
                <Button isLoading={mutation.isPending} onClick={() => void confirm()}>
                  {t('common.confirm')}
                </Button>
                <Button onClick={() => setStep('EDIT')} variant="ghost">
                  {t('admin.credits.edit')}
                </Button>
              </div>
              {mutation.error ? (
                <p class="ui-text-danger" role="alert">
                  {t('admin.credits.adjustError')}
                </p>
              ) : null}
            </section>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

export function AdminCreditsPage() {
  useBackNavigationTarget({ href: '/admin', labelKey: 'navigation.back.admin' });
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedMember, setSelectedMember] =
    useState<CreditMemberSummary | null>(null);
  const query = useAdminCreditMembersQuery({ page, pageSize: 20, search });
  const policies = useAdminCreditPoliciesQuery();
  return (
    <section class="page-layout page-layout--admin page-shell space-y-6">
      <PageHeader
        description={t('admin.credits.description')}
        eyebrow={t('admin.eyebrow')}
        id="admin-credits-title"
        title={t('admin.credits.title')}
      />
      <section aria-labelledby="credit-policies-title" class="ui-status-notice space-y-2">
        <h2 class="font-medium" id="credit-policies-title">
          {t('admin.credits.policiesTitle')}
        </h2>
        <p class="ui-text-muted text-sm leading-6">
          {policies.data?.allocation.some((policy) => policy.status === 'ACTIVE') ||
          policies.data?.limits.some((policy) => policy.status === 'ACTIVE')
            ? t('admin.credits.policiesConfigured')
            : t('admin.credits.policiesInactive')}
        </p>
        <p class="ui-text-muted text-sm leading-6">
          {t('admin.credits.renewalUnavailable')}
        </p>
      </section>
      <form
        class="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <TextField
          label={t('admin.credits.search')}
          onInput={(event) => setSearchInput(event.currentTarget.value)}
          type="search"
          value={searchInput}
        />
        <Button class="self-end" type="submit" variant="secondary">
          {t('programs.searchAction')}
        </Button>
      </form>
      {query.isPending ? <Skeleton class="h-72" /> : null}
      {query.error ? <ErrorState description={t('admin.credits.loadError')} /> : null}
      {query.data?.items.length === 0 ? (
        <EmptyState
          description={t('admin.credits.emptyDescription')}
          title={t('admin.credits.emptyTitle')}
        />
      ) : null}
      {query.data?.items.length ? (
        <ul class="admin-credit-members">
          {query.data.items.map((member) => (
            <MemberRow
              isSelected={selectedMember?.userId === member.userId}
              key={member.userId}
              member={member}
              onAdjust={setSelectedMember}
            />
          ))}
        </ul>
      ) : null}
      {query.data && query.data.totalPages > 1 ? (
        <nav aria-label={t('admin.accounts.pagination')} class="flex gap-3">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)} variant="ghost">
            {t('admin.accounts.previous')}
          </Button>
          <Button disabled={page >= query.data.totalPages} onClick={() => setPage(page + 1)} variant="ghost">
            {t('admin.accounts.next')}
          </Button>
        </nav>
      ) : null}
      <AdjustmentDrawer member={selectedMember} onDismiss={() => setSelectedMember(null)} />
    </section>
  );
}
