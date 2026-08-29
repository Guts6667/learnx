import { useState } from 'react';

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
  type BreakerReason,
  type BreakerStatus,
  type CreditMemberSummary,
  useAdminCorrectionBreakerReopenMutation,
  useAdminCreditAdjustmentMutation,
  useAdminCorrectionMonitoringQuery,
  useAdminCorrectionPreflightQuery,
  useAdminCreditMemberQuery,
  useAdminCreditMembersQuery,
  useAdminCreditPoliciesQuery,
} from '@/features/credits/credits';
import { useI18n } from '@/i18n';
import { CREDIT_OPERATION_REASON_MIN_LENGTH } from '@/shared/credit-rules';
import { formatLocalizedDate } from '@/shared/locale';

function value(amount: string, locale: 'en' | 'fr'): string {
  return BigInt(amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');
}

/**
 * Coupe-circuit de la correction assistée (V4.5-140).
 *
 * Trois règles indépendantes, trois seuils, trois taux. Un taux `null` veut
 * dire « pas assez de données » et n'est jamais rendu comme 0 % : un seuil
 * comparé à un taux inconnu n'est pas un seuil respecté, et un zéro rassurant
 * à la place d'une absence de mesure est précisément le mensonge que cet écran
 * doit rendre impossible.
 */
function BreakerRule({
  rate,
  reason,
  threshold,
  tripped,
}: {
  rate: number | null;
  reason: string;
  threshold: number;
  tripped: boolean;
}) {
  const { t } = useI18n();
  const crossed = rate !== null && rate > threshold;
  return (
    <div className="admin-breaker-rule">
      <dt>{reason}</dt>
      <dd>
        <span
          className={crossed ? 'admin-breaker-rule__rate--crossed' : undefined}
        >
          {rate === null
            ? t('admin.breaker.rateUnknown')
            : `${(rate * 100).toFixed(1)} %`}
        </span>
        <span className="ui-text-muted">
          {' '}
          {t('admin.breaker.threshold', {
            value: (threshold * 100).toFixed(0),
          })}
        </span>
        {crossed && !tripped ? (
          <span className="admin-breaker-rule__pending">
            {t('admin.breaker.suspendsAtNextQuote')}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function BreakerPanel({ breaker }: { breaker: BreakerStatus }) {
  const { locale, t } = useI18n();
  const reopen = useAdminCorrectionBreakerReopenMutation();
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const isOpen = breaker.state === 'OPEN';

  const reasonLabels: Record<BreakerReason, string> = {
    CHECKER_DISAGREEMENT: t('admin.breaker.reasonCheckerDisagreement'),
    LEARNER_CONTRADICTION_AT_HIGH: t('admin.breaker.reasonWrongAtHigh'),
    UNUSABLE_RATE: t('admin.breaker.reasonUnusable'),
  };

  return (
    <section
      aria-labelledby="correction-breaker-title"
      className="admin-breaker mt-4"
      data-state={breaker.state}
    >
      <div className="admin-breaker__heading">
        <h3 className="font-medium" id="correction-breaker-title">
          {t('admin.breaker.title')}
        </h3>
        <Badge tone={isOpen ? 'danger' : 'neutral'}>
          {isOpen
            ? t('admin.breaker.stateOpen')
            : t('admin.breaker.stateClosed')}
        </Badge>
      </div>

      {isOpen ? (
        <p className="admin-breaker__reason">
          {breaker.reason
            ? reasonLabels[breaker.reason]
            : t('admin.breaker.reasonUnknown')}
          {breaker.trippedAt
            ? ` · ${t('admin.breaker.trippedAt', {
                date: formatLocalizedDate(breaker.trippedAt, locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}`
            : ''}
        </p>
      ) : (
        <p className="ui-text-muted text-sm">{t('admin.breaker.serving')}</p>
      )}

      {breaker.evaluationError ? (
        <p className="admin-breaker__blind">
          {t('admin.breaker.blind', { error: breaker.evaluationError })}
        </p>
      ) : null}

      <dl className="admin-breaker-rules">
        <BreakerRule
          rate={breaker.rates.wrongAtHigh}
          reason={reasonLabels.LEARNER_CONTRADICTION_AT_HIGH}
          threshold={breaker.thresholds.wrongAtHigh}
          tripped={isOpen}
        />
        <BreakerRule
          rate={breaker.rates.checkerDisagreement}
          reason={reasonLabels.CHECKER_DISAGREEMENT}
          threshold={breaker.thresholds.checkerDisagreement}
          tripped={isOpen}
        />
        <BreakerRule
          rate={breaker.rates.unusable}
          reason={reasonLabels.UNUSABLE_RATE}
          threshold={breaker.thresholds.unusable}
          tripped={isOpen}
        />
      </dl>

      <p className="ui-text-muted text-sm">
        {t('admin.breaker.window', {
          observed: breaker.window.observed,
          size: breaker.window.size,
        })}
      </p>

      {isOpen ? (
        <div className="admin-breaker__reopen">
          {confirming ? (
            <>
              <Textarea
                description={t('admin.breaker.noteHelp')}
                id="breaker-reopen-note"
                label={t('admin.breaker.noteLabel')}
                maxLength={500}
                onInput={(event) => setNote(event.currentTarget.value)}
                rows={3}
                value={note}
              />
              <div className="admin-breaker__actions">
                <Button
                  isLoading={reopen.isPending}
                  onClick={() => {
                    void reopen.execute({ note }).then(
                      () => {
                        setConfirming(false);
                        setNote('');
                      },
                      () => undefined,
                    );
                  }}
                >
                  {t('admin.breaker.reopenConfirm')}
                </Button>
                <Button onClick={() => setConfirming(false)} variant="ghost">
                  {t('common.cancel')}
                </Button>
              </div>
              {reopen.error ? (
                <p className="ui-text-danger text-sm">
                  {t('admin.breaker.reopenError')}
                </p>
              ) : null}
            </>
          ) : (
            <Button onClick={() => setConfirming(true)} variant="secondary">
              {t('admin.breaker.reopenAction')}
            </Button>
          )}
          <p className="ui-text-muted text-sm">
            {t('admin.breaker.reopenAudit')}
          </p>
        </div>
      ) : null}
    </section>
  );
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
    <li className="admin-credit-member-row">
      <div>
        <h2 className="font-medium">{member.displayName}</h2>
        <p className="ui-text-muted mt-1 break-all text-sm">{member.email}</p>
      </div>
      <div>
        <span className="admin-credit-label">{t('credits.free')}</span>
        <strong>{value(member.projection.free.available, locale)}</strong>
      </div>
      <div>
        <span className="admin-credit-label">{t('credits.purchased')}</span>
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
        <div className="space-y-6">
          <div>
            <p className="font-medium">{member.displayName}</p>
            <p className="ui-text-muted mt-1 text-sm">{member.email}</p>
          </div>
          {detail.isPending ? <Skeleton className="h-48" /> : null}
          {detail.error ? (
            <ErrorState
              action={
                <Button onClick={() => void detail.retry()} variant="secondary">
                  {t('common.retry')}
                </Button>
              }
              description={t('admin.credits.memberError')}
            />
          ) : null}
          {detail.data ? (
            <div className="credit-admin-current">
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
              className="space-y-4"
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
              <label className="ui-field">
                <span className="ui-field__label">
                  {t('admin.credits.operation')}
                </span>
                <select
                  className="ui-field__control"
                  onInput={(event) => {
                    const next = event.currentTarget.value as
                      'GRANT' | 'REDUCE';
                    setOperation(next);
                    setCompensatesEntryId('');
                  }}
                  value={operation}
                >
                  <option value="GRANT">
                    {t('admin.credits.operationGrant')}
                  </option>
                  <option value="REDUCE">
                    {t('admin.credits.operationReduce')}
                  </option>
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
                <label className="ui-field">
                  <span className="ui-field__label">
                    {t('admin.credits.compensates')}
                  </span>
                  <select
                    className="ui-field__control"
                    onInput={(event) =>
                      setCompensatesEntryId(event.currentTarget.value)
                    }
                    required
                    value={compensatesEntryId}
                  >
                    <option value="">
                      {t('admin.credits.compensatesPlaceholder')}
                    </option>
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
                minLength={CREDIT_OPERATION_REASON_MIN_LENGTH}
                onInput={(event) => setReason(event.currentTarget.value)}
                required
                value={reason}
              />
              <Button
                disabled={
                  !amount ||
                  reason.trim().length < CREDIT_OPERATION_REASON_MIN_LENGTH ||
                  (operation === 'REDUCE' && !compensatesEntryId)
                }
                type="submit"
              >
                {t('admin.credits.review')}
              </Button>
            </form>
          ) : (
            <section
              aria-labelledby="credit-adjustment-summary"
              className="space-y-4"
            >
              <h3
                className="text-xl font-medium"
                id="credit-adjustment-summary"
              >
                {t('admin.credits.summary')}
              </h3>
              <dl className="credit-adjustment-summary">
                <div>
                  <dt>{t('admin.credits.amount')}</dt>
                  <dd>
                    {value(
                      operation === 'REDUCE' ? `-${amount}` : amount,
                      locale,
                    )}
                  </dd>
                </div>
                {operation === 'GRANT' ? (
                  <div>
                    <dt>{t('admin.credits.expiration')}</dt>
                    <dd>
                      {expiresAt
                        ? formatLocalizedDate(
                            new Date(expiresAt).toISOString(),
                            locale,
                            {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            },
                          )
                        : t('admin.credits.noExpiration')}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('admin.credits.reason')}</dt>
                  <dd>{reason}</dd>
                </div>
              </dl>
              <p className="ui-text-muted text-sm leading-6">
                {t('admin.credits.summaryNotice')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  isLoading={mutation.isPending}
                  onClick={() => void confirm()}
                >
                  {t('common.confirm')}
                </Button>
                <Button onClick={() => setStep('EDIT')} variant="ghost">
                  {t('admin.credits.edit')}
                </Button>
              </div>
              {mutation.error ? (
                <p className="ui-text-danger" role="alert">
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
  useBackNavigationTarget({
    href: '/admin',
    labelKey: 'navigation.back.admin',
  });
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedMember, setSelectedMember] =
    useState<CreditMemberSummary | null>(null);
  const query = useAdminCreditMembersQuery({ page, pageSize: 20, search });
  const policies = useAdminCreditPoliciesQuery();
  const monitoring = useAdminCorrectionMonitoringQuery();
  const correctionPreflight = useAdminCorrectionPreflightQuery();
  return (
    <section className="page-layout page-layout--admin page-shell space-y-6">
      <PageHeader
        description={t('admin.credits.description')}
        eyebrow={t('admin.eyebrow')}
        id="admin-credits-title"
        title={t('admin.credits.title')}
      />
      <section
        aria-labelledby="credit-policies-title"
        className="ui-status-notice space-y-2"
      >
        <h2 className="font-medium" id="credit-policies-title">
          {t('admin.credits.policiesTitle')}
        </h2>
        <p className="ui-text-muted text-sm leading-6">
          {policies.data?.allocation.some(
            (policy) => policy.status === 'ACTIVE',
          ) ||
          policies.data?.limits.some((policy) => policy.status === 'ACTIVE')
            ? t('admin.credits.policiesConfigured')
            : t('admin.credits.policiesInactive')}
        </p>
        <p className="ui-text-muted text-sm leading-6">
          {t('admin.credits.renewalUnavailable')}
        </p>
      </section>
      <section
        aria-labelledby="correction-monitoring-title"
        className="ui-control-surface rounded-lg p-4 sm:p-6"
      >
        <div className="space-y-2">
          <h2 className="font-medium" id="correction-monitoring-title">
            {t('admin.credits.monitoringTitle')}
          </h2>
          <p className="ui-text-muted max-w-3xl text-sm leading-6">
            {t('admin.credits.monitoringDescription')}
          </p>
        </div>
        {correctionPreflight.isPending ? (
          <Skeleton className="mt-4 h-16" />
        ) : null}
        {correctionPreflight.error ? (
          <div className="mt-4">
            <ErrorState
              action={
                <Button
                  onClick={() => void correctionPreflight.retry()}
                  variant="secondary"
                >
                  {t('common.retry')}
                </Button>
              }
              description={t('admin.credits.preflightError')}
            />
          </div>
        ) : null}
        {correctionPreflight.data ? (
          <div className="ui-status-notice mt-4 space-y-1" role="status">
            <p className="font-medium">
              {t(`admin.credits.preflight.${correctionPreflight.data.state}`)}
            </p>
            <p className="ui-text-muted text-sm leading-6">
              {t('admin.credits.preflightIdentity', {
                environment: correctionPreflight.data.deploymentEnvironment,
                identity: correctionPreflight.data.promotedBenchmarkId,
              })}
            </p>
          </div>
        ) : null}
        {monitoring.isPending ? <Skeleton className="mt-4 h-32" /> : null}
        {monitoring.error ? (
          <div className="mt-4">
            <ErrorState
              action={
                <Button
                  onClick={() => void monitoring.retry()}
                  variant="secondary"
                >
                  {t('common.retry')}
                </Button>
              }
              description={t('admin.credits.monitoringError')}
            />
          </div>
        ) : null}
        {monitoring.data ? (
          <>
            <BreakerPanel breaker={monitoring.data.breaker} />
            <dl className="admin-credit-monitoring mt-4">
              <div>
                <dt>{t('admin.credits.monitoringWrongAtHigh')}</dt>
                <dd>{monitoring.data.learner.wrongAtHigh}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringCorrections')}</dt>
                <dd>{monitoring.data.corrections.total}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringPartial')}</dt>
                <dd>{monitoring.data.corrections.partial}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringUnusable')}</dt>
                <dd>{monitoring.data.corrections.unusable}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringCheckerDisagreed')}</dt>
                <dd>{monitoring.data.checker.disagreed}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringCheckerUnavailable')}</dt>
                <dd>{monitoring.data.checker.unavailable}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringScoreWithheld')}</dt>
                <dd>{monitoring.data.confidence.scoreWithheld}</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringLearnerVotes')}</dt>
                <dd>
                  {monitoring.data.learner.helpful} /{' '}
                  {monitoring.data.learner.wrong}
                </dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringCostMedian')}</dt>
                <dd>{monitoring.data.cost.p50Usd} USD</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringCostP90')}</dt>
                <dd>{monitoring.data.cost.p90Usd} USD</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringProviderCost')}</dt>
                <dd>{monitoring.data.cost.totalUsd} USD</dd>
              </div>
              <div>
                <dt>{t('admin.credits.monitoringUnknownCost')}</dt>
                <dd>{monitoring.data.cost.unknownCostAttempts}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </section>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
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
        <Button className="self-end" type="submit" variant="secondary">
          {t('programs.searchAction')}
        </Button>
      </form>
      {query.isPending ? <Skeleton className="h-72" /> : null}
      {query.error ? (
        <ErrorState
          action={
            <Button onClick={() => void query.retry()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
          description={t('admin.credits.loadError')}
        />
      ) : null}
      {query.data?.items.length === 0 ? (
        <EmptyState
          description={t('admin.credits.emptyDescription')}
          title={t('admin.credits.emptyTitle')}
        />
      ) : null}
      {query.data?.items.length ? (
        <ul className="admin-credit-members">
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
        <nav aria-label={t('admin.accounts.pagination')} className="flex gap-3">
          <Button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            variant="ghost"
          >
            {t('admin.accounts.previous')}
          </Button>
          <Button
            disabled={page >= query.data.totalPages}
            onClick={() => setPage(page + 1)}
            variant="ghost"
          >
            {t('admin.accounts.next')}
          </Button>
        </nav>
      ) : null}
      <AdjustmentDrawer
        member={selectedMember}
        onDismiss={() => setSelectedMember(null)}
      />
    </section>
  );
}
