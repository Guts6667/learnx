import {
  calculateExpectedProgress,
  calculateProgressDelta,
  calculateTargetEndDate,
  calculateTemporalStatus,
  calculateTimelineSnapshot,
  clampPercent,
} from '@/lib/timeline';

const startedAt = new Date('2026-08-02T00:00:00.000Z');
const targetEndAt = new Date('2026-08-23T00:00:00.000Z');

describe('timeline calculations', () => {
  it('calcule en UTC la cible d’une étape de 21 jours', () => {
    expect(calculateTargetEndDate(startedAt, 21)?.toISOString()).toBe(
      '2026-08-23T00:00:00.000Z',
    );
    expect(
      calculateTargetEndDate(
        new Date('2026-03-28T23:00:00.000Z'),
        2,
      )?.toISOString(),
    ).toBe('2026-03-30T23:00:00.000Z');
  });

  it('retourne une cible absente pour une durée absente ou nulle', () => {
    expect(calculateTargetEndDate(null, 21)).toBeNull();
    expect(calculateTargetEndDate(startedAt, null)).toBeNull();
    expect(calculateTargetEndDate(startedAt, 0)).toBeNull();
  });

  it('tient compte du temps écoulé et borne la progression attendue', () => {
    expect(
      calculateExpectedProgress(
        startedAt,
        targetEndAt,
        new Date('2026-08-12T12:00:00.000Z'),
      ),
    ).toBe(50);
    expect(
      calculateExpectedProgress(
        startedAt,
        targetEndAt,
        new Date('2026-08-01T00:00:00.000Z'),
      ),
    ).toBe(0);
    expect(
      calculateExpectedProgress(
        startedAt,
        targetEndAt,
        new Date('2026-08-24T00:00:00.000Z'),
      ),
    ).toBe(100);
    expect(calculateExpectedProgress(null, targetEndAt, targetEndAt)).toBe(0);
    expect(calculateExpectedProgress(startedAt, startedAt, startedAt)).toBe(0);
  });

  it('borne les valeurs utilisées pour calculer l’écart', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(calculateProgressDelta(150, -20)).toBe(100);
    expect(calculateProgressDelta(35, 50)).toBe(-15);
  });

  it('classe les périodes actives avec priorité à l’échéance dépassée', () => {
    const baseInput = {
      actualProgress: 50,
      completedAt: null,
      now: new Date('2026-08-12T12:00:00.000Z'),
      startedAt,
      targetEndAt,
    };

    expect(calculateTemporalStatus({ ...baseInput, progressDelta: 10 })).toBe(
      'ahead',
    );
    expect(calculateTemporalStatus({ ...baseInput, progressDelta: 0 })).toBe(
      'on_track',
    );
    expect(calculateTemporalStatus({ ...baseInput, progressDelta: -10 })).toBe(
      'behind',
    );
    expect(
      calculateTemporalStatus({
        ...baseInput,
        now: new Date('2026-08-24T00:00:00.000Z'),
        progressDelta: -1,
      }),
    ).toBe('overdue');
    expect(
      calculateTemporalStatus({
        ...baseInput,
        actualProgress: 100,
        now: new Date('2026-08-24T00:00:00.000Z'),
        progressDelta: 0,
      }),
    ).toBe('on_track');
  });

  it('attribue un statut final avec une tolérance de 24 heures', () => {
    const baseInput = {
      actualProgress: 100,
      now: targetEndAt,
      progressDelta: 0,
      startedAt,
      targetEndAt,
    };

    expect(
      calculateTemporalStatus({
        ...baseInput,
        completedAt: new Date('2026-08-21T00:00:00.000Z'),
      }),
    ).toBe('completed_early');
    expect(
      calculateTemporalStatus({ ...baseInput, completedAt: targetEndAt }),
    ).toBe('completed_on_time');
    expect(
      calculateTemporalStatus({
        ...baseInput,
        completedAt: new Date('2026-08-24T00:00:00.000Z'),
      }),
    ).toBe('completed_on_time');
    expect(
      calculateTemporalStatus({
        ...baseInput,
        completedAt: new Date('2026-08-25T00:00:00.000Z'),
      }),
    ).toBe('completed_late');
    expect(
      calculateTemporalStatus({
        ...baseInput,
        completedAt: null,
        startedAt: null,
      }),
    ).toBeNull();
  });

  it('recalcule la progression après une modification manuelle de la cible', () => {
    const now = new Date('2026-08-12T12:00:00.000Z');

    expect(calculateExpectedProgress(startedAt, targetEndAt, now)).toBe(50);
    expect(
      calculateExpectedProgress(
        startedAt,
        new Date('2026-09-02T00:00:00.000Z'),
        now,
      ),
    ).toBe(33.87);
  });

  it('produit un instantané temporel cohérent', () => {
    expect(
      calculateTimelineSnapshot({
        actualProgress: 35,
        completedAt: null,
        now: new Date('2026-08-12T12:00:00.000Z'),
        startedAt,
        targetEndAt,
      }),
    ).toMatchObject({
      actualPercent: 35,
      expectedPercent: 50,
      progressDelta: -15,
      temporalStatus: 'behind',
    });
  });
});
