import { calculateModuleProgress } from '@/lib/module-progress';

describe('calculateModuleProgress', () => {
  it('agrège les pourcentages des leçons', () => {
    expect(
      calculateModuleProgress([
        { percent: 100, status: 'COMPLETED' },
        { percent: 50, status: 'IN_PROGRESS' },
      ]),
    ).toEqual({ percent: 75, status: 'IN_PROGRESS' });
  });

  it('distingue les modules disponibles, terminés et verrouillés', () => {
    expect(
      calculateModuleProgress([{ percent: 0, status: 'AVAILABLE' }]),
    ).toEqual({ percent: 0, status: 'AVAILABLE' });
    expect(
      calculateModuleProgress([{ percent: 100, status: 'COMPLETED' }]),
    ).toEqual({ percent: 100, status: 'COMPLETED' });
    expect(
      calculateModuleProgress([{ percent: 100, status: 'COMPLETED' }], true),
    ).toEqual({ percent: 100, status: 'LOCKED' });
  });

  it('borne les valeurs incohérentes reçues de la base', () => {
    expect(
      calculateModuleProgress([
        { percent: -10, status: 'IN_PROGRESS' },
        { percent: 130, status: 'IN_PROGRESS' },
      ]).percent,
    ).toBe(50);
  });
});
