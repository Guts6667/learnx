import { useEffect, useState } from 'react';
import * as z from 'zod/mini';

/**
 * Le catalogue public (V4.5-206).
 *
 * Lu sur `GET /api/public/credit-packs`, la seule surface tarifaire qu'un
 * visiteur sans session peut lire. Même règle qu'ailleurs : on VÉRIFIE la
 * forme au lieu de l'affirmer, pour qu'une réponse dérivée devienne un état
 * visible et non une carte de prix à moitié rendue (V4.5-182).
 */
const publicCreditPackSchema = z.object({
  /**
   * Les chiffres dérivés arrivent servis (V4.5-212) : la section publique
   * affiche le même taux, le même bonus et la même capacité que l'écran
   * authentifié parce qu'ils viennent de la même source, pas parce que deux
   * calculs sont tombés d'accord.
   */
  approximateCorrections: z.string(),
  bonusCredits: z.string(),
  credits: z.string(),
  creditsPerEuro: z.string(),
  currency: z.string(),
  key: z.string(),
  label: z.string(),
  /** Les deux libellés voyagent ensemble : un seul corps mis en cache. */
  labelEn: z.string(),
  oncePerAccount: z.boolean(),
  priceMinor: z.string(),
});

/**
 * Exigés, jamais optionnels.
 *
 * Un champ toléré absent devient un champ qu'on affiche à moitié : la carte
 * rendrait le prix sans sa condition d'achat, et c'est précisément la ligne
 * qu'un visiteur doit lire avant de se décider. Une réponse incomplète est
 * donc un état visible — `UNAVAILABLE` — pas une carte amputée (V4.5-182).
 */
const publicCreditPacksResponseSchema = z.object({
  correctionQuoteCredits: z.string(),
  correctionReservationCredits: z.string(),
  packs: z.array(publicCreditPackSchema),
});

export type PublicCreditPack = z.infer<typeof publicCreditPackSchema>;

/**
 * Les quatre états de la section, distincts à dessein.
 *
 * `SOON` et `UNAVAILABLE` ne disent pas la même chose et ne doivent pas être
 * confondus : le premier est un fait sur le produit — aucun palier n'est
 * activé, et seule une décision du propriétaire le change (V4.5-164) — le
 * second est un aveu sur nous, la liste n'a pas pu être lue. Les fondre dans
 * un seul message ferait annoncer « bientôt » un jour où les prix existent.
 */
export type PublicPacksState =
  | { kind: 'LOADING' }
  | {
      kind: 'PACKS';
      correctionQuoteCredits: string;
      correctionReservationCredits: string;
      packs: PublicCreditPack[];
    }
  | { kind: 'SOON' }
  | { kind: 'UNAVAILABLE' };

export function usePublicCreditPacks(): PublicPacksState {
  const [state, setState] = useState<PublicPacksState>({ kind: 'LOADING' });

  useEffect(() => {
    const controller = new AbortController();

    // `fetch` nu plutôt qu'`apiRequest` : celui-ci envoie les cookies, et
    // c'est la seule requête de la page publique qui ne doit en porter aucun.
    // Une réponse commune à tous les visiteurs, demandée sans identité, reste
    // cachable par un cache partagé — ce que l'en-tête de la route promet.
    fetch('/api/public/credit-packs', {
      credentials: 'omit',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const parsed = z.safeParse(publicCreditPacksResponseSchema, payload);
        if (!parsed.success) {
          setState({ kind: 'UNAVAILABLE' });
          return;
        }
        setState(
          parsed.data.packs.length === 0
            ? { kind: 'SOON' }
            : {
                kind: 'PACKS',
                correctionQuoteCredits: parsed.data.correctionQuoteCredits,
                correctionReservationCredits:
                  parsed.data.correctionReservationCredits,
                packs: parsed.data.packs,
              },
        );
      })
      .catch(() => {
        // L'abandon au démontage passe aussi par ici ; poser l'état sur un
        // composant démonté ne coûte rien et évite un drapeau de plus.
        if (!controller.signal.aborted) setState({ kind: 'UNAVAILABLE' });
      });

    return () => controller.abort();
  }, []);

  return state;
}
