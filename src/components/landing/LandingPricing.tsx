import { Button } from '@/components/ui/Button';
import {
  type PublicCreditPack,
  usePublicCreditPacks,
} from '@/features/public-catalogue/public-packs';
import { useI18n } from '@/i18n';
import {
  formatMinorAmount,
  formatWholeNumber,
  packLabel,
} from '@/shared/locale';

/**
 * La carte d'un palier sur la page publique (V4.5-213).
 *
 * Le même ordre et les mêmes phrases que sur l'écran d'achat — nom, crédits,
 * prix, taux, bonus s'il existe, capacité approximative, condition d'achat —
 * parce que c'est le même produit. Les phrases partagées vivent une seule fois
 * (`creditPack.*`) : deux jeux de mots pour un même palier divergeraient, et
 * celui qu'on ne relit pas est celui qui devient faux.
 *
 * Sans bouton d'achat, et ce n'est pas un oubli : un visiteur anonyme ne peut
 * pas acheter. L'action de la section reste la demande d'accès, une fois, à
 * côté du titre. Un bouton par carte mènerait à une connexion, c'est-à-dire à
 * une impasse déguisée en achat.
 */
function PricingTier({ pack }: { pack: PublicCreditPack }) {
  const { locale, t } = useI18n();
  const hasBonus = BigInt(pack.bonusCredits) > 0n;

  return (
    <li className="landing-pricing-tier" key={pack.key}>
      <h3>{packLabel(pack, locale)}</h3>
      <strong className="landing-pricing-credits">
        {t('landing.pricing.packCredits', {
          // Le pluriel se joue sur un et non-un ; convertir un `BigInt` de
          // crédits en flottant pour cela n'apprendrait rien de plus.
          count: pack.credits === '1' ? 1 : 2,
          credits: formatWholeNumber(pack.credits, locale),
        })}
      </strong>
      <p className="landing-pricing-amount">
        {formatMinorAmount(pack.priceMinor, pack.currency, locale)}
      </p>
      <ul className="landing-pricing-figures">
        <li>
          {t('creditPack.rate', {
            rate: formatWholeNumber(pack.creditsPerEuro, locale),
          })}
        </li>
        {hasBonus ? (
          <li className="landing-pricing-bonus">
            {t('creditPack.bonus', {
              bonus: formatWholeNumber(pack.bonusCredits, locale),
            })}
          </li>
        ) : null}
        <li>
          {t('creditPack.approximateCorrections', {
            corrections: formatWholeNumber(pack.approximateCorrections, locale),
            count: pack.approximateCorrections === '1' ? 1 : 2,
          })}
        </li>
      </ul>
      {pack.oncePerAccount ? (
        <p className="landing-pricing-condition">
          {t('creditPack.oncePerAccount')}
        </p>
      ) : null}
    </li>
  );
}

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
      className={
        // Les cartes prennent toute la largeur ; la phrase d'attente reste en
        // colonne de droite. Le CSS ne peut pas voir ce que le catalogue a
        // rendu, donc l'état le dit.
        state.kind === 'PACKS'
          ? 'landing-section landing-pricing landing-pricing--tiers'
          : 'landing-section landing-pricing'
      }
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
          <>
            <ul className="landing-pricing-tiers">
              {state.packs.map((pack) => (
                <PricingTier key={pack.key} pack={pack} />
              ))}
            </ul>
            {/*
              Le devis et la réserve d'une correction, une fois sous la grille :
              ils portent sur la correction et non sur un palier, et ils sont ce
              qui rend approximative la capacité annoncée sur chaque carte.
            */}
            <p className="landing-pricing-note">
              {t('creditPack.correctionNote', {
                quote: formatWholeNumber(state.correctionQuoteCredits, locale),
                reservation: formatWholeNumber(
                  state.correctionReservationCredits,
                  locale,
                ),
              })}
            </p>
          </>
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
