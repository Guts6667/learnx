import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readStylesheetSourceGraph } from '@/test-utils/stylesheet-source';

const learner = readFileSync(resolve('src/pages/CreditsPage.tsx'), 'utf8');
const publicPricing = readFileSync(
  resolve('src/components/landing/LandingPricing.tsx'),
  'utf8',
);
const admin = readFileSync(resolve('src/pages/AdminCreditsPage.tsx'), 'utf8');
const styles = readStylesheetSourceGraph(
  resolve('src/styles/index.css'),
).source;

describe('V4-008 credit surfaces', () => {
  it('keeps both credit origins primary and the total secondary', () => {
    expect(learner).toContain("t('credits.free')");
    expect(learner).toContain("t('credits.purchased')");
    expect(learner).toContain('credit-balance-row--secondary');
  });

  it('uses the shared responsive drawer and a confirmation summary', () => {
    expect(admin).toContain('<Drawer');
    expect(admin).toContain("setStep('REVIEW')");
    expect(admin).toContain("t('admin.credits.summary')");
    expect(styles).toContain('@media (max-width: 390px)');
    expect(styles).toContain('.credit-adjustment-summary');
  });

  it('does not expose a fabricated policy, and never derives an amount itself', () => {
    expect(admin).toContain("t('admin.credits.policiesInactive')");
    expect(admin).not.toContain('PURCHASED');

    // V4-008 banned the words price/pack/payment from this screen, because it
    // only handled complimentary allocations: naming money there would have
    // invented a commercial notion the product did not have. V4.5-162 gives it
    // real refunds (owner decision `owner-refund-policy-2026-08-29`), so the
    // vocabulary ban no longer describes the surface — but what it protected
    // still holds, and is asserted here instead: the screen displays the
    // amount the server computed and derives none of its own. The pro-rata
    // rule lives once, in `voluntaryRefundMinor`, server-side.
    expect(admin).toContain('computation.refundedMinor');
    expect(admin).not.toMatch(/packPriceMinor\s*[*/]/u);
    expect(admin).not.toContain('voluntaryRefundMinor');
  });

  it('never prices anything itself, and never claims a grant the server has not made', () => {
    // V4.5-164 requires that no price appear that an owner has not arbitrated.
    // The learner screen therefore renders `priceMinor` from the catalogue and
    // holds no figure of its own — not a literal amount, not a multiplication,
    // and not a float conversion on the way to the screen.
    expect(learner).toContain('pack.priceMinor');
    expect(learner).not.toMatch(/[\d\s]€|EUR/u);
    expect(learner).not.toMatch(/priceMinor\s*[*/]/u);
    expect(learner).not.toMatch(/(?<![\w])Number\(|parseFloat\(/u);

    // Coming back from the payment page proves a session ended, not that the
    // credits exist: only a FULFILLED order lets the screen say they do.
    expect(learner).toContain("order?.status === 'FULFILLED'");

    // And whether anything is on sale is read from the catalogue, not guessed
    // and not learned from the failure of a purchase already offered
    // (V4.5-207). The 503 stays read, for the sale that closes between the
    // page load and the click.
    expect(learner).toContain('paymentsEnabled === false');
    expect(learner).toContain("checkout.refusal === 'PAYMENTS_DISABLED'");
  });

  it('affiche les chiffres de la carte tels que servis, sur les deux surfaces', () => {
    // V4.5-213 ajoute quatre chiffres à la carte. Ils sont dérivés une fois,
    // côté serveur (V4.5-212) : un taux ou une capacité recalculés à l'écran
    // survivraient à un changement de grille sans rien faire rougir, et trois
    // surfaces annonceraient une capacité que plus rien ne justifie.
    for (const surface of [learner, publicPricing]) {
      expect(surface).toContain('pack.creditsPerEuro');
      expect(surface).toContain('pack.approximateCorrections');
      // `bonusCredits` n'est plus affiché : avec des totaux fusionnés, le
      // surplus au-dessus de la parité et le bonus early adopter en pourcentage
      // se lisaient mal côte à côte. Il reste servi et testé côté grille.
      expect(surface).not.toContain('pack.bonusCredits');
      // Aucun opérateur sur les chiffres servis : ni sur eux, ni sur les
      // crédits dont on pourrait les rederiver.
      expect(surface).not.toMatch(
        /(creditsPerEuro|bonusCredits|approximateCorrections)\s*[*/+-]/u,
      );
      expect(surface).not.toMatch(/pack\.credits\s*[*/+-]/u);
      expect(surface).not.toMatch(/(?<![\w])Number\(|parseFloat\(/u);
    }
  });

  it('lit la limite d’achat sur le serveur au lieu de reconnaître une clé', () => {
    // La règle « un seul achat par compte » appartient au serveur :
    // `ENTRY_TIER_PACK_KEY` la porte et le 409 l'applique. Un écran qui
    // comparerait la clé lui-même en serait un second dépositaire, et un
    // renommage de palier ferait taire la phrase sans casser un test.
    for (const surface of [learner, publicPricing]) {
      expect(surface).toContain('pack.oncePerAccount');
      // Et la mise en avant vient du serveur pour la même raison.
      expect(surface).toContain('pack.recommended');
      expect(surface).not.toMatch(/['"`]entry['"`]/u);
      expect(surface).not.toMatch(/['"`]regular['"`]/u);
    }

    // Et « déjà acheté » se lit sur le catalogue, jamais déduit de
    // l'historique des commandes : un remboursement change le statut d'une
    // commande sans rouvrir le droit (décision de Rayan, 31 août 2026), et
    // c'est `purchasable` — bâti sur `fulfilledAt` — qui porte cette règle.
    expect(learner).toContain('pack.purchasable === false');
  });
});
