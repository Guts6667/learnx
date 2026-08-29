import { monthlyCycleKey, policyForCohort } from './trial-allocation';

describe('monthlyCycleKey', () => {
  it('découpe les cycles sur le mois parisien, pas UTC', () => {
    // 23:30 UTC on 31 January is already 00:30 on 1 February in Paris. A UTC
    // cut would hand a learner two grants across that boundary.
    expect(monthlyCycleKey(new Date('2026-01-31T23:30:00Z'))).toBe('2026-02');
    expect(monthlyCycleKey(new Date('2026-01-31T21:00:00Z'))).toBe('2026-01');
  });

  it('reste stable au sein d’un mois', () => {
    expect(monthlyCycleKey(new Date('2026-03-01T00:00:00Z'))).toBe(
      monthlyCycleKey(new Date('2026-03-28T12:00:00Z')),
    );
  });
});

describe('policyForCohort', () => {
  const general = { allocationAmount: 10n, cohort: null, id: 'general' };
  const trial = {
    allocationAmount: 50n,
    cohort: 'TRIAL' as const,
    id: 'trial',
  };

  it('préfère la politique qui nomme la cohorte', () => {
    expect(policyForCohort([general, trial], 'TRIAL')?.id).toBe('trial');
  });

  it('retombe sur la politique générale', () => {
    expect(policyForCohort([general, trial], 'EARLY_ADOPTER')?.id).toBe(
      'general',
    );
  });

  it('ne rend rien quand aucune politique ne sert la cohorte', () => {
    expect(policyForCohort([trial], 'EARLY_ADOPTER')).toBeNull();
  });
});
