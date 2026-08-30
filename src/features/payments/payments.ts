import { useCallback, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import {
  memberOrdersResponseSchema,
  refundPreviewResponseSchema,
} from '@/features/payments/payments-contracts';
import { ApiClientError, apiRequest } from '@/lib/api-client';
import { useObservedQuery } from '@/lib/observed-query';

export type { PaymentOrderLine } from '@/features/payments/payments-contracts';

const adminPaymentsKey = ['admin', 'payments'] as const;
const adminCreditsKey = ['admin', 'credits'] as const;

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
