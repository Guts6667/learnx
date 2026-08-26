import {
  criticalCoverageFailures,
  criticalManifestFailures,
  evaluateCriticalCoverage,
  type CoverageSummary,
  type CriticalCoverageConfiguration,
} from '@/lib/v4-1-critical-coverage';

const configuration: CriticalCoverageConfiguration = {
  discoveryRules: {
    auth: ['^src/(?:auth.*|access)\\.ts$'],
  },
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

  it('fails when discovery finds a critical production file outside the manifest', () => {
    expect(
      criticalManifestFailures(configuration, [
        'src/access.ts',
        'src/auth.ts',
        'src/auth-extra.ts',
      ]),
    ).toEqual([
      'auth: discovered critical file is undeclared: src/auth-extra.ts',
    ]);
  });

  it('fails when a domain has no discovery rule or duplicate files', () => {
    const invalidConfiguration: CriticalCoverageConfiguration = {
      discoveryRules: {},
      domains: { auth: ['src/auth.ts', 'src/auth.ts'] },
      schemaVersion: 1,
      thresholdLinesPercent: 90,
    };

    expect(criticalManifestFailures(invalidConfiguration, [])).toEqual([
      'auth: duplicate manifest files src/auth.ts',
      'auth: no discovery rules declared',
    ]);
  });

  it('fails when a declared file is not protected by any discovery rule', () => {
    const incompleteConfiguration: CriticalCoverageConfiguration = {
      discoveryRules: { auth: ['^src/auth\\.ts$'] },
      domains: { auth: ['src/auth.ts', 'src/access.ts'] },
      schemaVersion: 1,
      thresholdLinesPercent: 90,
    };

    expect(
      criticalManifestFailures(incompleteConfiguration, [
        'src/access.ts',
        'src/auth.ts',
      ]),
    ).toEqual([
      'auth: declared critical file is outside discovery rules: src/access.ts',
    ]);
  });
});
