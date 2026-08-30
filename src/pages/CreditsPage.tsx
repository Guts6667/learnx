import type { FormEvent } from 'react';
import { useState } from 'react';

import { navigate } from '@/app/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Notice } from '@/components/ui/Notice';
import { QueryState } from '@/components/learnx/QueryState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import {
  useCreditIncreaseRequestMutation,
  useOwnCreditsQuery,
} from '@/features/credits/credits';
import {
  type CreditPack,
  type OwnPaymentOrder,
  useCreditCheckoutMutation,
  useCreditPacksQuery,
  useOwnOrdersQuery,
} from '@/features/payments/payments';
import { useI18n } from '@/i18n';
import { CREDIT_OPERATION_REASON_MIN_LENGTH } from '@/shared/credit-rules';
import {
  formatLocalizedDate,
  formatMinorAmount,
  formatWholeNumber,
} from '@/shared/locale';

interface CreditsPageProps {
  /** Le retour de la page de paiement, lu dans l'URL par la route. */
  checkout?: 'cancelled' | 'success';
  /** L'identifiant de commande que `success_url` rapporte. */
  orderId?: string;
}

/**
 * Ce que l'écran dit au retour du paiement (V4.5-204).
 *
 * Être renvoyé sur `success_url` prouve que la session de paiement s'est
 * terminée, pas que l'argent est acquis ni que les crédits sont attribués :
 * c'est le webhook qui fait foi. La seule preuve acceptée ici est donc l'état
 * de la commande tel que le serveur le renvoie. Tant qu'il n'est pas
 * `FULFILLED` — commande absente de la page chargée comprise — l'écran dit que
 * l'attribution est en cours, et n'affirme rien de plus.
 */
function CheckoutReturn({
  checkout,
  onRefresh,
  order,
}: {
  checkout: 'cancelled' | 'success';
  onRefresh: () => void;
  order: OwnPaymentOrder | null;
}) {
  const { t } = useI18n();

  if (checkout === 'cancelled') {
    return (
      <Notice
        className="credit-checkout-return"
        title={t('credits.checkout.cancelledTitle')}
      >
        <p>{t('credits.checkout.cancelledDescription')}</p>
      </Notice>
    );
  }

  const settled = order?.status === 'FULFILLED';

  return (
    <Notice
      className="credit-checkout-return"
      title={
        settled
          ? t('credits.checkout.settledTitle')
          : t('credits.checkout.successTitle')
      }
      tone={settled ? 'safe' : 'info'}
    >
      <p>
        {settled
          ? t('credits.checkout.settledDescription')
          : t('credits.checkout.successDescription')}
      </p>
      {settled ? null : (
        <div className="mt-4">
          <Button onClick={onRefresh} variant="secondary">
            {t('credits.checkout.refresh')}
          </Button>
        </div>
      )}
    </Notice>
  );
}

function PackCard({
  disabled,
  isLoading,
  onBuy,
  pack,
}: {
  disabled: boolean;
  isLoading: boolean;
  onBuy: (packKey: string) => void;
  pack: CreditPack;
}) {
  const { locale, t } = useI18n();

  return (
    <li className="credit-pack">
      <h3 className="credit-pack__label">{pack.label}</h3>
      <p className="credit-pack__credits">
        {t('credits.purchase.packCredits', {
          // Le pluriel se choisit sur un et non-un ; convertir un `BigInt` de
          // crédits en nombre flottant pour cela n'apprendrait rien de plus.
          count: pack.credits === '1' ? 1 : 2,
          credits: formatWholeNumber(pack.credits, locale),
        })}
      </p>
      <strong className="credit-pack__price">
        {formatMinorAmount(pack.priceMinor, pack.currency, locale)}
      </strong>
      <Button
        aria-label={t('credits.purchase.buyPack', { label: pack.label })}
        disabled={disabled}
        isLoading={isLoading}
        onClick={() => onBuy(pack.key)}
      >
        {t('credits.purchase.buy')}
      </Button>
    </li>
  );
}

/**
 * Les paliers, et le départ vers la page de paiement.
 *
 * Aucun prix n'est écrit ici : les paliers viennent du catalogue, et un prix
 * en dur serait un prix que personne n'a arbitré (V4.5-164).
 */
function PurchasePanel() {
  const { t } = useI18n();
  const packs = useCreditPacksQuery();
  const checkout = useCreditCheckoutMutation();
  const [buying, setBuying] = useState<string | null>(null);
  const [suspendedUrl, setSuspendedUrl] = useState<string | null>(null);

  async function buy(packKey: string) {
    setBuying(packKey);
    setSuspendedUrl(null);
    try {
      const started = await checkout.execute(packKey);
      // Le serveur tient à dire que la correction est suspendue plutôt que de
      // vendre en silence. On s'arrête donc avant la redirection : c'est le
      // seul instant où l'apprenant peut encore renoncer en connaissance de
      // cause, et c'est aussi le seul où le fait est certainement à jour.
      if (started.correctionSuspended) {
        setSuspendedUrl(started.url);
        return;
      }
      navigate(started.url);
    } catch {
      // L'état de la mutation porte le refus ou l'erreur, et les rend.
    }
  }

  // Le catalogue ne porte pas l'état de la vente : quand les paiements sont
  // coupés, le serveur ne le dit qu'au moment du POST, par un 503. On retire
  // donc les boutons dès qu'il l'a dit, plutôt que de laisser cliquer sur un
  // achat dont on sait maintenant qu'il échouera.
  const closed = checkout.refusal === 'PAYMENTS_DISABLED';
  const offered = closed ? [] : (packs.data ?? []);

  return (
    <Section className="credit-purchase ui-card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-medium">{t('credits.purchase.title')}</h2>
        {offered.length > 0 ? (
          <p className="ui-text-muted mt-2 leading-7">
            {t('credits.purchase.description')}
          </p>
        ) : null}
      </div>

      {packs.isPending ? <Skeleton className="h-32" /> : null}
      {packs.error ? (
        <ErrorState
          action={
            <Button onClick={() => void packs.retry()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
          description={t('credits.purchase.loadError')}
        />
      ) : null}

      {packs.data && offered.length === 0 ? (
        <EmptyState
          description={t('credits.purchase.closedDescription')}
          title={t('credits.purchase.closedTitle')}
        />
      ) : null}

      {suspendedUrl === null ? (
        offered.length > 0 ? (
          <ul className="credit-pack-list">
            {offered.map((pack) => (
              <PackCard
                disabled={checkout.isPending && buying !== pack.key}
                isLoading={checkout.isPending && buying === pack.key}
                key={pack.key}
                onBuy={(packKey) => void buy(packKey)}
                pack={pack}
              />
            ))}
          </ul>
        ) : null
      ) : (
        <Notice tone="attention" title={t('credits.purchase.suspendedTitle')}>
          <p>{t('credits.purchase.suspendedDescription')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => navigate(suspendedUrl)}>
              {t('credits.purchase.suspendedContinue')}
            </Button>
            <Button onClick={() => setSuspendedUrl(null)} variant="ghost">
              {t('credits.purchase.suspendedCancel')}
            </Button>
          </div>
        </Notice>
      )}

      {checkout.refusal ? (
        <p className="ui-status-notice" role="status">
          {checkout.refusal === 'PAYMENTS_DISABLED'
            ? t('credits.purchase.refusalPaymentsDisabled')
            : t('credits.purchase.refusalPackUnavailable')}
        </p>
      ) : null}
      {checkout.error ? (
        <p className="ui-text-danger" role="alert">
          {t('credits.purchase.error')}
        </p>
      ) : null}
    </Section>
  );
}

function OrderRow({ order }: { order: OwnPaymentOrder }) {
  const { locale, t } = useI18n();
  const settled = order.status === 'FULFILLED';

  return (
    <li className="credit-order-row">
      <div>
        <h3 className="font-medium">{order.packKey}</h3>
        <p className="ui-text-muted mt-1 text-sm">
          {formatLocalizedDate(order.createdAt, locale, {
            dateStyle: 'medium',
          })}
        </p>
      </div>
      <strong>
        {formatMinorAmount(order.amountMinor, order.currency, locale)}
      </strong>
      <Badge tone={settled ? 'success' : 'neutral'}>
        {t(`credits.orders.status.${order.status}`)}
      </Badge>
    </li>
  );
}

function OrdersPanel({
  orders,
}: {
  orders: ReturnType<typeof useOwnOrdersQuery>;
}) {
  const { t } = useI18n();

  return (
    <Section className="credit-orders ui-card space-y-4 p-5 sm:p-6">
      <h2 className="text-xl font-medium">{t('credits.orders.title')}</h2>

      {orders.isPending ? <Skeleton className="h-24" /> : null}
      {orders.error ? (
        <ErrorState
          action={
            <Button onClick={() => void orders.retry()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
          description={t('credits.orders.loadError')}
        />
      ) : null}
      {orders.data && orders.data.length === 0 ? (
        <EmptyState
          description={t('credits.orders.emptyDescription')}
          title={t('credits.orders.empty')}
        />
      ) : null}

      {orders.data && orders.data.length > 0 ? (
        <ul className="credit-order-list">
          {orders.data.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

export function CreditsPage({ checkout, orderId }: CreditsPageProps) {
  const { locale, t } = useI18n();
  const query = useOwnCreditsQuery();
  const mutation = useCreditIncreaseRequestMutation();
  const orders = useOwnOrdersQuery();
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState(false);

  const returnedOrder =
    orderId === undefined
      ? null
      : (orders.data?.find((order) => order.id === orderId) ?? null);

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
      {checkout ? (
        <CheckoutReturn
          checkout={checkout}
          onRefresh={() => {
            void query.refetch();
            void orders.retry();
          }}
          order={returnedOrder}
        />
      ) : null}
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
              {formatWholeNumber(query.data.projection.free.available, locale)}
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
              {formatWholeNumber(
                query.data.projection.purchased.available,
                locale,
              )}
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
              {formatWholeNumber(query.data.projection.totalAvailable, locale)}
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
              {formatWholeNumber(query.data.projection.totalReserved, locale)}
            </strong>
          </div>
        </Card>
      ) : null}
      <PurchasePanel />
      <OrdersPanel orders={orders} />
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
              minLength={CREDIT_OPERATION_REASON_MIN_LENGTH}
              onInput={(event) => {
                const nextReason = event.currentTarget.value;
                if (nextReason !== reason) mutation.abandon();
                setReason(nextReason);
              }}
              required
              value={reason}
            />
            <Button
              disabled={
                reason.trim().length < CREDIT_OPERATION_REASON_MIN_LENGTH
              }
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
