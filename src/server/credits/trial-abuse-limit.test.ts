import {
  DEFAULT_TRIAL_ABUSE_LIMITS,
  evaluateTrialAbuse,
} from './trial-abuse-limit';

const NOW = new Date('2026-03-15T12:00:00Z');

function marker(overrides: Partial<{ grants: number; lastSeenAt: Date }> = {}) {
  return {
    firstSeenAt: new Date('2026-01-01T00:00:00Z'),
    grants: 1,
    lastSeenAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

describe('evaluateTrialAbuse', () => {
  it('laisse passer un visiteur jamais vu', () => {
    // The default answer for a first-time visitor has to be yes, or the trial
    // never starts for anyone.
    expect(evaluateTrialAbuse({ marker: null, now: NOW })).toBe('ALLOWED');
  });

  it('laisse passer sous le plafond et hors fenêtre', () => {
    expect(evaluateTrialAbuse({ marker: marker(), now: NOW })).toBe('ALLOWED');
  });

  it('refuse au plafond', () => {
    expect(
      evaluateTrialAbuse({
        marker: marker({ grants: DEFAULT_TRIAL_ABUSE_LIMITS.maxGrantsPerKey }),
        now: NOW,
      }),
    ).toBe('CAP_REACHED');
  });

  it('refuse une rafale dans la fenêtre', () => {
    expect(
      evaluateTrialAbuse({
        marker: marker({
          grants: DEFAULT_TRIAL_ABUSE_LIMITS.maxGrantsPerWindow,
          lastSeenAt: new Date('2026-03-15T06:00:00Z'),
        }),
        now: NOW,
      }),
    ).toBe('TOO_FAST');
  });

  it('laisse une adresse partagée accumuler hors fenêtre', () => {
    // A shared office address legitimately feeds accounts over months. The cap
    // is what stops that, not the velocity rule.
    expect(
      evaluateTrialAbuse({
        marker: marker({
          grants: 2,
          lastSeenAt: new Date('2026-02-01T00:00:00Z'),
        }),
        now: NOW,
      }),
    ).toBe('ALLOWED');
  });

  it('sépare vraiment les deux règles', () => {
    // Same count, different recency, different verdict: proof the velocity
    // rule is not just the cap under another name.
    const recent = evaluateTrialAbuse({
      marker: marker({
        grants: 2,
        lastSeenAt: new Date('2026-03-15T11:00:00Z'),
      }),
      now: NOW,
    });
    const old = evaluateTrialAbuse({
      marker: marker({
        grants: 2,
        lastSeenAt: new Date('2026-01-15T00:00:00Z'),
      }),
      now: NOW,
    });
    expect([recent, old]).toEqual(['TOO_FAST', 'ALLOWED']);
  });
});
