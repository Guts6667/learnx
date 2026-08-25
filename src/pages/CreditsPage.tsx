import { useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
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

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    await mutation.execute(reason);
    setReason('');
    setSuccess(true);
  }

  return (
    <section class="totem-credits-page page-layout page-layout--work page-shell space-y-6">
      <PageHeader
        description={t('credits.description')}
        eyebrow={t('credits.eyebrow')}
        id="credits-title"
        title={t('credits.title')}
      />
      {query.isPending ? <Skeleton class="h-64" /> : null}
      {query.error ? (
        <ErrorState description={t('credits.loadError')} />
      ) : null}
      {query.data ? (
        <Card class="totem-credit-balances space-y-0">
          <div class="credit-balance-row">
            <div>
              <h2 class="font-medium">{t('credits.free')}</h2>
              <p class="ui-text-muted mt-1 text-sm">
                {t('credits.freeDescription')}
              </p>
            </div>
            <strong>{credits(query.data.projection.free.available, locale)}</strong>
          </div>
          <div class="credit-balance-row">
            <div>
              <h2 class="font-medium">{t('credits.purchased')}</h2>
              <p class="ui-text-muted mt-1 text-sm">
                {t('credits.purchasedDescription')}
              </p>
            </div>
            <strong>
              {credits(query.data.projection.purchased.available, locale)}
            </strong>
          </div>
          <div class="credit-balance-row credit-balance-row--secondary">
            <div>
              <h2 class="font-medium">{t('credits.total')}</h2>
              <p class="ui-text-muted mt-1 text-sm">
                {t('credits.totalDescription')}
              </p>
            </div>
            <strong>{credits(query.data.projection.totalAvailable, locale)}</strong>
          </div>
          <div class="credit-balance-row credit-balance-row--secondary">
            <div>
              <h2 class="font-medium">{t('credits.reserved')}</h2>
              <p class="ui-text-muted mt-1 text-sm">
                {t('credits.reservedDescription')}
              </p>
            </div>
            <strong>{credits(query.data.projection.totalReserved, locale)}</strong>
          </div>
        </Card>
      ) : null}
      <Section class="totem-credit-request ui-card space-y-4 p-5 sm:p-6">
        <div>
          <h2 class="text-xl font-medium">{t('credits.increase.title')}</h2>
          <p class="ui-text-muted mt-2 leading-7">
            {t('credits.increase.description')}
          </p>
        </div>
        {query.data?.pendingIncreaseRequest ? (
          <p class="ui-status-notice" role="status">
            {t('credits.increase.pending')}
          </p>
        ) : (
          <form class="space-y-4" onSubmit={submit}>
            <Textarea
              label={t('credits.increase.reason')}
              maxLength={1_000}
              minLength={8}
              onInput={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
            <Button disabled={reason.trim().length < 8} isLoading={mutation.isPending}>
              {t('credits.increase.submit')}
            </Button>
          </form>
        )}
        {success ? (
          <p class="ui-text-success" role="status">
            {t('credits.increase.success')}
          </p>
        ) : null}
        {mutation.error ? (
          <p class="ui-text-danger" role="alert">
            {t('credits.increase.error')}
          </p>
        ) : null}
      </Section>
    </section>
  );
}
