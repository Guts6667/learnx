import {
  calculateProgramPercent,
  calculateStagePercent,
} from '../../src/server/api/_lib/timeline-progress';

function lesson(percent?: number) {
  return { progress: percent === undefined ? [] : [{ percent }] };
}

describe('curriculum progress aggregation', () => {
  it('calcule la moyenne des leçons puis des modules', () => {
    expect(
      calculateStagePercent({
        modules: [
          { lessons: [lesson(100), lesson(50)] },
          { lessons: [lesson(25)] },
        ],
      }),
    ).toBe(50);
  });

  it('considère une leçon sans suivi comme non commencée', () => {
    expect(
      calculateProgramPercent([
        { modules: [{ lessons: [lesson(100), lesson()] }] },
        { modules: [{ lessons: [lesson(50)] }] },
      ]),
    ).toBe(50);
  });

  it('retourne zéro pour une hiérarchie vide et borne les valeurs', () => {
    expect(calculateStagePercent({ modules: [] })).toBe(0);
    expect(
      calculateStagePercent({
        modules: [{ lessons: [lesson(-10), lesson(130)] }],
      }),
    ).toBe(50);
  });
});
