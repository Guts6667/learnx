export interface CoverageMetric {
  covered: number;
  total: number;
}

export interface CoverageSummaryEntry {
  lines: CoverageMetric;
}

export type CoverageSummary = Record<string, CoverageSummaryEntry>;

export interface CriticalCoverageConfiguration {
  domains: Record<string, string[]>;
  schemaVersion: number;
  thresholdLinesPercent: number;
}

export interface CriticalCoverageDomainResult {
  covered: number;
  files: number;
  missingFiles: string[];
  name: string;
  percent: number;
  total: number;
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}

function percentage(covered: number, total: number): number {
  return total === 0 ? 0 : (covered / total) * 100;
}

export function evaluateCriticalCoverage(
  configuration: CriticalCoverageConfiguration,
  coverageSummary: CoverageSummary,
  projectRoot: string,
): CriticalCoverageDomainResult[] {
  const normalizedSummary = new Map(
    Object.entries(coverageSummary).map(([path, entry]) => [
      normalizePath(path),
      entry,
    ]),
  );
  const normalizedRoot = normalizePath(projectRoot).replace(/\/$/, '');

  return Object.entries(configuration.domains).map(([name, files]) => {
    let covered = 0;
    let total = 0;
    const missingFiles: string[] = [];

    for (const file of files) {
      const normalizedFile = normalizePath(file);
      const entry = normalizedSummary.get(
        `${normalizedRoot}/${normalizedFile}`,
      );
      if (!entry) {
        missingFiles.push(normalizedFile);
        continue;
      }
      covered += entry.lines.covered;
      total += entry.lines.total;
    }

    return {
      covered,
      files: files.length,
      missingFiles,
      name,
      percent: percentage(covered, total),
      total,
    };
  });
}

export function criticalCoverageFailures(
  results: CriticalCoverageDomainResult[],
  thresholdLinesPercent: number,
): string[] {
  return results.flatMap((result) => {
    const failures: string[] = [];
    if (result.missingFiles.length > 0) {
      failures.push(
        `${result.name}: missing coverage for ${result.missingFiles.join(', ')}`,
      );
    }
    if (result.percent < thresholdLinesPercent) {
      failures.push(
        `${result.name}: ${result.percent.toFixed(2)}% lines is below ${thresholdLinesPercent}%`,
      );
    }
    return failures;
  });
}
