import {
  belongsToCurrentModuleRun,
  getCanonicalActivityKind,
} from '@/lib/canonical-activities';

describe('canonical learning activities', () => {
  it.each(['reading', 'watching', 'listening', 'checklist'] as const)(
    'route %s vers une tâche légère',
    (type) => {
      expect(getCanonicalActivityKind(type)).toBe('TASK');
    },
  );

  it.each(['writing', 'practice', 'reflection', 'project'] as const)(
    'route %s vers un exercice productif',
    (type) => {
      expect(getCanonicalActivityKind(type)).toBe('EXERCISE');
    },
  );

  it('ne reporte jamais une réussite antérieure à la reprise du module', () => {
    const currentRunStartedAt = new Date('2026-08-04T10:00:00.000Z');

    expect(
      belongsToCurrentModuleRun(
        new Date('2026-08-04T09:59:59.999Z'),
        currentRunStartedAt,
      ),
    ).toBe(false);
    expect(
      belongsToCurrentModuleRun(currentRunStartedAt, currentRunStartedAt),
    ).toBe(true);
    expect(belongsToCurrentModuleRun(null, currentRunStartedAt)).toBe(false);
  });
});
