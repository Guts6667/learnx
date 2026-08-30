import { Button } from '@/components/ui/Button';
import { usePublicCreditPacks } from '@/features/public-catalogue/public-packs';
import { useI18n } from '@/i18n';
import { formatMinorAmount, formatWholeNumber } from '@/shared/locale';

/**
 * La section tarifs de la page publique (V4.5-206).
 *
 * Les paliers viennent du catalogue et rien d'autre. Aucun prix n'est écrit
 * ici, ni dans le catalogue tant qu'un palier n'a pas été activé : un palier
 * est inactif jusqu'à une décision du propriétaire (V4.5-161, V4.5-164), et un
 * catalogue actif vide est donc la façon dont le produit dit « pas encore ».
 * Cette section le répète, sans inventer de tarif d'attente.
 *
 * L'échec de lecture a son propre message. Dire « bientôt » parce qu'on n'a
 * pas su lire la liste marcherait aujourd'hui, où elle est vide de toute
 * façon, et mentirait le jour où elle ne l'est plus.
 */
export function LandingPricing() {
  const { locale, t } = useI18n();
  const state = usePublicCreditPacks();

  return (
    <section
      aria-labelledby="landing-pricing"
      className="landing-section landing-pricing"
      id="pricing"
    >
      <div className="landing-pricing-heading">
        <p className="page-eyebrow">{t('landing.pricing.eyebrow')}</p>
        <h2 id="landing-pricing">{t('landing.pricing.title')}</h2>
        <p>{t('landing.pricing.description')}</p>
        <div className="landing-pricing-actions">
          <Button asChild>
            <a href="#early-adopter">{t('landing.pricing.cta')}</a>
          </Button>
        </div>
      </div>

      <div className="landing-pricing-offer">
        {state.kind === 'PACKS' ? (
          <ul className="landing-pricing-tiers">
            {state.packs.map((pack) => (
              <li className="landing-pricing-tier" key={pack.key}>
                <h3>{pack.label}</h3>
                <p className="landing-pricing-credits">
                  {t('landing.pricing.packCredits', {
                    // Le pluriel se joue sur un et non-un ; convertir un `BigInt`
                    // de crédits en flottant pour cela n'apprendrait rien de plus.
                    count: pack.credits === '1' ? 1 : 2,
                    credits: formatWholeNumber(pack.credits, locale),
                  })}
                </p>
                <strong className="landing-pricing-amount">
                  {formatMinorAmount(pack.priceMinor, pack.currency, locale)}
                </strong>
              </li>
            ))}
          </ul>
        ) : null}

        {state.kind === 'SOON' ? (
          <p className="landing-pricing-notice">{t('landing.pricing.soon')}</p>
        ) : null}

        {state.kind === 'UNAVAILABLE' ? (
          <p className="landing-pricing-notice">
            {t('landing.pricing.unavailable')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
