import {
  criticalCoverageFailures,
  evaluateCriticalCoverage,
  type CoverageSummary,
  type CriticalCoverageConfiguration,
} from '@/lib/v4-1-critical-coverage';

const configuration: CriticalCoverageConfiguration = {
  domains: {
    auth: ['src/auth.ts', 'src/access.ts'],
  },
  schemaVersion: 1,
  thresholdLinesPercent: 90,
};

function onlyResult(summary: CoverageSummary) {
  const [result] = evaluateCriticalCoverage(configuration, summary, '/repo');
  if (!result) throw new Error('Expected one critical coverage domain.');
  return result;
}

describe('V4.1 critical coverage gate', () => {
  it('aggregates line coverage for every declared domain file', () => {
    const summary: CoverageSummary = {
      '/repo/src/access.ts': { lines: { covered: 8, total: 10 } },
      '/repo/src/auth.ts': { lines: { covered: 10, total: 10 } },
    };

    const result = onlyResult(summary);

    expect(result).toEqual({
      covered: 18,
      files: 2,
      missingFiles: [],
      name: 'auth',
      percent: 90,
      total: 20,
    });
    expect(criticalCoverageFailures([result], 90)).toEqual([]);
  });

  it('fails closed when a declared critical file is absent from coverage', () => {
    const summary: CoverageSummary = {
      '/repo/src/auth.ts': { lines: { covered: 10, total: 10 } },
    };

    const result = onlyResult(summary);
    const failures = criticalCoverageFailures([result], 90);

    expect(result?.missingFiles).toEqual(['src/access.ts']);
    expect(failures).toEqual(['auth: missing coverage for src/access.ts']);
  });

  it('reports a domain below the strict line threshold', () => {
    const summary: CoverageSummary = {
      '/repo/src/access.ts': { lines: { covered: 7, total: 10 } },
      '/repo/src/auth.ts': { lines: { covered: 10, total: 10 } },
    };

    const result = onlyResult(summary);

    expect(criticalCoverageFailures([result], 90)).toEqual([
      'auth: 85.00% lines is below 90%',
    ]);
  });
});
