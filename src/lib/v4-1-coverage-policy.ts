export interface CoverageThresholds {
  branches: number;
  functions: number;
  lines: number;
  statements: number;
}

export const V4_1_GLOBAL_COVERAGE_MINIMUM_PERCENT = 80;
export const V4_1_CRITICAL_LINES_MINIMUM_PERCENT = 90;

export const V4_1_TEST_SUPPORT_COVERAGE_EXCLUDES = [
  '**/*.test-support.ts',
  'src/test-utils/**',
] as const;

export function assertV4_1GlobalCoveragePolicy(
  thresholds: CoverageThresholds,
): void {
  const lowered = Object.entries(thresholds).filter(
    ([, value]) => value < V4_1_GLOBAL_COVERAGE_MINIMUM_PERCENT,
  );

  if (lowered.length > 0) {
    throw new Error(
      `V4.1 final coverage thresholds cannot be lower than ${V4_1_GLOBAL_COVERAGE_MINIMUM_PERCENT}%: ${lowered
        .map(([metric, value]) => `${metric}=${value}%`)
        .join(', ')}`,
    );
  }
}

export function assertV4_1CriticalCoveragePolicy(
  thresholdLinesPercent: number,
): void {
  if (thresholdLinesPercent < V4_1_CRITICAL_LINES_MINIMUM_PERCENT) {
    throw new Error(
      `V4.1 critical line coverage cannot be lower than ${V4_1_CRITICAL_LINES_MINIMUM_PERCENT}%: received ${thresholdLinesPercent}%`,
    );
  }
}

export function isV4_1TestSupportPath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  return (
    normalized.endsWith('.test-support.ts') ||
    normalized.startsWith('src/test-utils/')
  );
}
