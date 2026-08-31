import { useCallback, useState } from 'react';
import * as z from 'zod/mini';

import { useAppQueryClient } from '@/app/providers';
import {
  checkoutResponseSchema,
  creditPacksResponseSchema,
  memberOrdersResponseSchema,
  ownOrdersResponseSchema,
  refundPreviewResponseSchema,
} from '@/features/payments/payments-contracts';
import { ApiClientError, apiRequest } from '@/lib/api-client';
import { useObservedQuery } from '@/lib/observed-query';

export type {
  CreditPack,
  OwnPaymentOrder,
  PaymentOrderLine,
} from '@/features/payments/payments-contracts';

const adminPaymentsKey = ['admin', 'payments'] as const;
const adminCreditsKey = ['admin', 'credits'] as const;
const ownPaymentsKey = ['credits', 'payments'] as const;

export function useAdminMemberOrdersQuery(userId: string, page: number) {
  const result = useObservedQuery(
    `/api/admin/credits/members/${encodeURIComponent(userId)}/orders?page=${page}&pageSize=20`,
    [...adminPaymentsKey, 'orders', userId, page],
    memberOrdersResponseSchema,
  );
  return {
    data: result.data?.page,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

/**
 * L'aperçu du remboursement. Le calcul vient du serveur ; l'écran ne fait que
 * l'afficher.
 */
export function useAdminRefundPreviewQuery(orderId: string | null) {
  const result = useObservedQuery(
    `/api/admin/payments/${encodeURIComponent(orderId ?? '')}/refund-preview`,
    [...adminPaymentsKey, 'refund-preview', orderId],
    refundPreviewResponseSchema,
    { enabled: orderId !== null },
  );
  return {
    data: result.data?.resource,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

/**
 * Codes que le serveur oppose au POST. Ils portent le préfixe `PAYMENT_`, là
 * où les mêmes faits s'appellent autrement dans `refusal.code` de l'aperçu :
 * deux vocabulaires pour cinq faits, arbitré ainsi côté voie A. On traduit ici
 * plutôt que dans la page, pour que l'écran n'ait qu'un seul vocabulaire.
 */
const refusalByErrorCode = {
  PAYMENT_ALREADY_REFUNDED: 'ALREADY_REFUNDED',
  PAYMENT_DISPUTE_LOST: 'DISPUTE_LOST',
  PAYMENT_ORDER_NOT_FULFILLED: 'NOT_FULFILLED',
  PAYMENT_REFUND_PENDING: 'REFUND_PENDING',
  PAYMENT_UNDER_DISPUTE: 'UNDER_DISPUTE',
} as const;

/**
 * Ce que l'écran doit dire quand le remboursement est refusé au dernier
 * instant. `STALE` : le lot a bougé entre l'aperçu et la confirmation.
 * `SUPERSEDED` : le lot n'avait pas bougé, mais quelqu'un d'autre a remboursé
 * — deux administrateurs peuvent tenir chacun un jeton valide, et c'est la
 * garde en base qui tranche. Dans les deux cas l'aperçu est relu et l'écran
 * redemande ; il ne rembourse jamais sur une information périmée.
 */
export type RefundConflict =
  | { kind: 'STALE' }
  | {
      kind: 'SUPERSEDED';
      refusal: (typeof refusalByErrorCode)[keyof typeof refusalByErrorCode];
    };

function readConflict(error: unknown): RefundConflict | null {
  if (!(error instanceof ApiClientError) || error.status !== 409) return null;
  if (error.code === 'PAYMENT_REFUND_PREVIEW_STALE') return { kind: 'STALE' };
  const refusal =
    refusalByErrorCode[error.code as keyof typeof refusalByErrorCode];
  return refusal ? { kind: 'SUPERSEDED', refusal } : null;
}

export function useAdminPaymentRefundMutation() {
  const queryClient = useAppQueryClient();
  const [conflict, setConflict] = useState<RefundConflict | null>(null);
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (
      orderId: string,
      input: { expectedRemainingOnLot: string; note?: string },
    ) => {
      setConflict(null);
      setError(undefined);
      setIsPending(true);
      try {
        await apiRequest<unknown>(
          `/api/admin/payments/${encodeURIComponent(orderId)}/refund`,
          {
            body: JSON.stringify({
              expectedRemainingOnLot: input.expectedRemainingOnLot,
              ...(input.note && input.note.trim().length > 0
                ? { note: input.note.trim() }
                : {}),
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        // On ne lit pas la réponse : elle répète des chiffres que l'aperçu et
        // la ligne de commande portent déjà. Relire les deux surfaces laisse
        // une seule forme de la vérité à l'écran.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminPaymentsKey }),
          queryClient.invalidateQueries({ queryKey: adminCreditsKey }),
        ]);
      } catch (requestError) {
        const detected = readConflict(requestError);
        if (detected) {
          setConflict(detected);
          // L'aperçu affiché est faux à cet instant : on le relit avant que
          // l'administrateur puisse confirmer une seconde fois.
          await queryClient.invalidateQueries({ queryKey: adminPaymentsKey });
        } else {
          setError(requestError);
        }
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  const dismissConflict = useCallback(() => setConflict(null), []);

  return { conflict, dismissConflict, error, execute, isPending };
}

/**
 * Le catalogue d'achat (V4.5-204), dans l'ordre où le serveur le rend, avec
 * l'état de la vente (V4.5-205).
 *
 * Les deux voyagent ensemble parce que l'écran a besoin des deux ensemble : un
 * catalogue sans son état ne dit pas si ce qu'il montre est achetable, et
 * l'écran devrait le deviner — en devinant « ouverte », donc en proposant un
 * achat qui échoue.
 */
export function useCreditPacksQuery() {
  const result = useObservedQuery(
    '/api/credits/packs',
    [...ownPaymentsKey, 'packs'],
    creditPacksResponseSchema,
  );
  return {
    data: result.data,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

/** Les commandes de l'apprenant lui-même, la plus récente en tête. */
export function useOwnOrdersQuery() {
  const result = useObservedQuery(
    '/api/credits/orders',
    [...ownPaymentsKey, 'orders'],
    ownOrdersResponseSchema,
  );
  return {
    data: result.data?.orders,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

/**
 * Pourquoi le paiement n'a pas démarré, quand le serveur l'a refusé pour une
 * raison qui se dit à l'apprenant. Tout le reste est une erreur, et une erreur
 * s'affiche comme telle plutôt que déguisée en refus explicable.
 */
export type CheckoutRefusal =
  'ENTRY_TIER_ALREADY_PURCHASED' | 'PACK_UNAVAILABLE' | 'PAYMENTS_DISABLED';

const refusalByCheckoutErrorCode = {
  // 409 : le palier d'entrée est limité à un achat par compte, et celui-ci a
  // servi. La carte le dit déjà avant le clic (V4.5-213) ; ce refus reste lu
  // pour l'achat parti d'une page chargée avant, et pour l'appel direct.
  ENTRY_TIER_ALREADY_PURCHASED: 'ENTRY_TIER_ALREADY_PURCHASED',
  // 503 : la vente a été fermée entre le chargement de la page et le clic.
  PRICING_UNAVAILABLE: 'PAYMENTS_DISABLED',
  // 404 : inconnu et inactif répondent pareil, pour qu'un appelant ne puisse
  // pas énumérer les clés en observant la différence (`selectPack`).
  RESOURCE_NOT_FOUND: 'PACK_UNAVAILABLE',
} as const;

export function useCreditCheckoutMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<CheckoutRefusal | null>(null);

  const execute = useCallback(
    async (packKey: string) => {
      setError(undefined);
      setIsPending(true);
      setRefusal(null);
      try {
        const payload = await apiRequest<unknown>('/api/credits/checkout', {
          body: JSON.stringify({ packKey }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        const parsed = z.safeParse(checkoutResponseSchema, payload);
        if (!parsed.success) {
          // Une URL qu'on n'a pas vérifiée est une redirection à l'aveugle,
          // et celle-ci mène à une page de paiement.
          throw new Error(
            'La réponse de /api/credits/checkout ne correspond pas au contrat attendu.',
          );
        }
        // La commande vient d'être créée côté serveur : l'historique affiché
        // est déjà périmé, qu'on redirige ou non.
        await queryClient.invalidateQueries({ queryKey: ownPaymentsKey });
        return parsed.data.resource.checkout;
      } catch (requestError) {
        const code =
          requestError instanceof ApiClientError
            ? refusalByCheckoutErrorCode[
                requestError.code as keyof typeof refusalByCheckoutErrorCode
              ]
            : undefined;
        if (code) {
          setRefusal(code);
          // Le serveur vient de contredire le catalogue affiché — la vente a
          // fermé, ou le palier a disparu. On le relit plutôt que de garder à
          // l'écran un état que le serveur a démenti (V4.5-207).
          await queryClient.invalidateQueries({ queryKey: ownPaymentsKey });
        } else setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return { error, execute, isPending, refusal };
}
