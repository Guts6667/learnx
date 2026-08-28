import type { FormEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QueryState } from '@/components/learnx/QueryState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import {
  useCreditIncreaseRequestMutation,
  useOwnCreditsQuery,
} from '@/features/credits/credits';
import { useI18n } from '@/i18n';

function credits(value: string, locale: 'en' | 'fr'): string {
  return BigInt(value).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');
}

export function CreditsPage() {
  const { locale, t } = useI18n();
  const query = useOwnCreditsQuery();
  const mutation = useCreditIncreaseRequestMutation();
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);
    try {
      await mutation.execute(reason);
      setReason('');
      setSuccess(true);
    } catch {
      // La mutation conserve l'erreur et le motif pour une reprise explicite.
    }
  }

  return (
    <section className="totem-credits-page page-layout page-layout--work page-shell space-y-6">
      <PageHeader
        description={t('credits.description')}
        eyebrow={t('credits.eyebrow')}
        id="credits-title"
        title={t('credits.title')}
      />
      <QueryState
        error={query.error}
        errorDescription={t('credits.loadError')}
        isPending={query.isPending}
        loadingLabel={t('common.loading')}
        onRetry={query.refetch}
        retryLabel={t('common.retry')}
      />
      {query.data ? (
        <Card className="totem-credit-balances space-y-0">
          <div className="credit-balance-row">
            <div>
              <h2 className="font-medium">{t('credits.free')}</h2>
              <p className="ui-text-muted mt-1 text-sm">
                {t('credits.freeDescription')}
              </p>
            </div>
            <strong>
              {credits(query.data.projection.free.available, locale)}
            </strong>
          </div>
          <div className="credit-balance-row">
            <div>
              <h2 className="font-medium">{t('credits.purchased')}</h2>
              <p className="ui-text-muted mt-1 text-sm">
                {t('credits.purchasedDescription')}
              </p>
            </div>
            <strong>
              {credits(query.data.projection.purchased.available, locale)}
            </strong>
          </div>
          <div className="credit-balance-row credit-balance-row--secondary">
            <div>
              <h2 className="font-medium">{t('credits.total')}</h2>
              <p className="ui-text-muted mt-1 text-sm">
                {t('credits.totalDescription')}
              </p>
            </div>
            <strong>
              {credits(query.data.projection.totalAvailable, locale)}
            </strong>
          </div>
          <div className="credit-balance-row credit-balance-row--secondary">
            <div>
              <h2 className="font-medium">{t('credits.reserved')}</h2>
              <p className="ui-text-muted mt-1 text-sm">
                {t('credits.reservedDescription')}
              </p>
            </div>
            <strong>
              {credits(query.data.projection.totalReserved, locale)}
            </strong>
          </div>
        </Card>
      ) : null}
      <Section className="totem-credit-request ui-card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-xl font-medium">{t('credits.increase.title')}</h2>
          <p className="ui-text-muted mt-2 leading-7">
            {t('credits.increase.description')}
          </p>
        </div>
        {query.data?.pendingIncreaseRequest ? (
          <p className="ui-status-notice" role="status">
            {t('credits.increase.pending')}
          </p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <Textarea
              label={t('credits.increase.reason')}
              maxLength={1_000}
              minLength={8}
              onInput={(event) => {
                const nextReason = event.currentTarget.value;
                if (nextReason !== reason) mutation.abandon();
                setReason(nextReason);
              }}
              required
              value={reason}
            />
            <Button
              disabled={reason.trim().length < 8}
              isLoading={mutation.isPending}
              type="submit"
            >
              {t('credits.increase.submit')}
            </Button>
          </form>
        )}
        {success ? (
          <p className="ui-text-success" role="status">
            {t('credits.increase.success')}
          </p>
        ) : null}
        {mutation.error ? (
          <p className="ui-text-danger" role="alert">
            {t('credits.increase.error')}
          </p>
        ) : null}
      </Section>
    </section>
  );
}
