import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const learner = readFileSync(resolve('src/pages/CreditsPage.tsx'), 'utf8');
const admin = readFileSync(resolve('src/pages/AdminCreditsPage.tsx'), 'utf8');
const styles = readFileSync(resolve('src/styles/index.css'), 'utf8');

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

  it('does not expose a fabricated policy or mutate purchased credits', () => {
    expect(admin).toContain("t('admin.credits.policiesInactive')");
    expect(admin).not.toContain('PURCHASED');
    expect(admin).not.toMatch(/price|pack|payment/i);
  });
});
