import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readStylesheetSourceGraph } from '@/test-utils/stylesheet-source';

const learner = readFileSync(resolve('src/pages/CreditsPage.tsx'), 'utf8');
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
    expect(learner).not.toMatch(/Number\(|parseFloat\(/u);

    // Coming back from the payment page proves a session ended, not that the
    // credits exist: only a FULFILLED order lets the screen say they do.
    expect(learner).toContain("order?.status === 'FULFILLED'");
  });
});
