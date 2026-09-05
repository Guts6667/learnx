import { useCallback, useState } from 'react';

import type { UiLocale } from '@/i18n';
import { apiRequest } from '@/lib/api-client';

export type PublicLeadPurpose = 'LAUNCH_UPDATES' | 'EARLY_ADOPTER';
type PublicLeadAction = 'confirm' | 'unsubscribe' | 'delete';

export function usePublicLeadMutation() {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<unknown>();

  const mutateAsync = useCallback(
    async (input: {
      consent: true;
      email: string;
      /**
       * Requis pour `EARLY_ADOPTER`, facultatif pour `LAUNCH_UPDATES` où il
       * ne sert qu'à saluer la personne. 1 à 80 caractères après trim.
       */
      firstName?: string;
      /**
       * « What usually slows you down? », facultatif. Question de
       * candidature : refusée sur un simple abonnement. 1 à 2 000 caractères.
       */
      friction?: string;
      /**
       * La case « launch updates », décochée par défaut. Abonne EN PLUS de la
       * candidature, dans la même requête — jamais un second appel.
       */
      launchUpdates?: boolean;
      locale: UiLocale;
      /** Requis pour `EARLY_ADOPTER`, refusé sinon. 20 à 2 000 caractères. */
      motivation?: string;
      purpose: PublicLeadPurpose;
    }) => {
      setIsPending(true);
      setError(undefined);
      try {
        await apiRequest('/api/public-leads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        setIsSuccess(true);
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { error, isPending, isSuccess, mutateAsync };
}

export async function applyPublicLeadAction(
  action: PublicLeadAction,
  token: string,
) {
  return apiRequest<{ status: string }>(`/api/public-leads/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}
