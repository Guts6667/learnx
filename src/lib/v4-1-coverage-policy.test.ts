import {
  assertV4_1CriticalCoveragePolicy,
  assertV4_1GlobalCoveragePolicy,
  isV4_1TestSupportPath,
  V4_1_CRITICAL_LINES_MINIMUM_PERCENT,
  V4_1_GLOBAL_COVERAGE_MINIMUM_PERCENT,
  V4_1_TEST_SUPPORT_COVERAGE_EXCLUDES,
} from '@/lib/v4-1-coverage-policy';

describe('V4.1 coverage policy', () => {
  it('pins the release minima and test-support exclusions', () => {
    expect(V4_1_GLOBAL_COVERAGE_MINIMUM_PERCENT).toBe(80);
    expect(V4_1_CRITICAL_LINES_MINIMUM_PERCENT).toBe(90);
    expect(V4_1_TEST_SUPPORT_COVERAGE_EXCLUDES).toEqual([
      '**/*.test-support.ts',
      'src/server/ai/fake-structured-provider.ts',
      'src/test-utils/**',
    ]);
  });

  it('accepts final global thresholds at or above 80 percent', () => {
    expect(() =>
      assertV4_1GlobalCoveragePolicy({
        branches: 80,
        functions: 81,
        lines: 90,
        statements: 80,
      }),
    ).not.toThrow();
  });

  it('rejects every lowered final global metric', () => {
    expect(() =>
      assertV4_1GlobalCoveragePolicy({
        branches: 79.99,
        functions: 80,
        lines: 80,
        statements: 79,
      }),
    ).toThrow('branches=79.99%, statements=79%');
  });

  it('rejects a critical-domain threshold below 90 percent', () => {
    expect(() => assertV4_1CriticalCoveragePolicy(90)).not.toThrow();
    expect(() => assertV4_1CriticalCoveragePolicy(89.99)).toThrow(
      'received 89.99%',
    );
  });

  it.each([
    'src/lib/example.test-support.ts',
    'src/server/ai/fake-structured-provider.ts',
    'src/test-utils/stylesheet-source.ts',
  ])('recognizes test-only coverage support: %s', (path) => {
    expect(isV4_1TestSupportPath(path)).toBe(true);
  });

  it('keeps production modules in the measured scope', () => {
    expect(
      isV4_1TestSupportPath('src/server/corrections/correction-outcome.ts'),
    ).toBe(false);
  });
});
