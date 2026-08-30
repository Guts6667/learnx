import { planNeonCapacity, type NeonBranch } from './neon-capacity';

const NOW = new Date('2026-08-31T12:00:00Z');

function branch(name: string, minutesAgo: number, id = name): NeonBranch {
  return {
    createdAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    id,
    name,
  };
}

function plan(branches: NeonBranch[], ceiling = 10) {
  return planNeonCapacity({ branches, ceiling, maxAgeMinutes: 120, now: NOW });
}

const full = (count: number) =>
  Array.from({ length: count }, (_, i) => branch(`permanent-${i}`, 60 * 24));

describe('planNeonCapacity', () => {
  it('avance tant qu’il reste une place', () => {
    expect(plan(full(9))).toEqual({ kind: 'PROCEED', used: 9 });
  });

  it('n’avance pas sur la dernière place déjà prise', () => {
    // A run needs one slot, so the test is strictly-less-than.
    expect(plan(full(10)).kind).not.toBe('PROCEED');
  });

  it('balaie les branches ci-* trop vieilles pour être en cours', () => {
    const branches = [...full(9), branch('ci-123-1', 180, 'br-old')];

    expect(plan(branches)).toEqual({ kind: 'SWEEP', ids: ['br-old'] });
  });

  it('ne balaie pas une branche ci-* encore plausible', () => {
    // The integration job times out at 30 minutes; 10 minutes old may well be
    // a run in flight, and deleting it would break a passing pipeline.
    const branches = [...full(9), branch('ci-123-1', 10)];

    expect(plan(branches)).toEqual({ kind: 'WAIT', used: 10 });
  });

  it('ne touche à rien qui ne soit pas exactement une branche de CI', () => {
    // `preview`, `production`, `staging` are old and would all match a loose
    // rule. Only the exact shape integration.yml produces is sweepable.
    const branches = [
      ...full(6),
      branch('preview', 60 * 24 * 30),
      branch('production', 60 * 24 * 90),
      branch('ci-manual-test', 60 * 24),
      branch('ci-123', 60 * 24),
    ];

    expect(plan(branches)).toEqual({ kind: 'WAIT', used: 10 });
  });

  it('attend plutôt que de supprimer ce qu’il ne peut pas dater', () => {
    // An unparseable timestamp is not evidence of age.
    const branches = [
      ...full(9),
      { createdAt: 'not a date', id: 'br-x', name: 'ci-1-1' },
    ];

    expect(plan(branches)).toEqual({ kind: 'WAIT', used: 10 });
  });

  it('balaie toutes les orphelines d’un coup, pas une par tour', () => {
    const branches = [
      ...full(8),
      branch('ci-1-1', 300, 'br-a'),
      branch('ci-2-1', 400, 'br-b'),
    ];

    expect(plan(branches)).toEqual({ kind: 'SWEEP', ids: ['br-a', 'br-b'] });
  });

  it('suit le plafond qu’on lui donne, pas un 10 en dur', () => {
    expect(plan(full(3), 3).kind).toBe('WAIT');
    expect(plan(full(3), 4)).toEqual({ kind: 'PROCEED', used: 3 });
  });
});
