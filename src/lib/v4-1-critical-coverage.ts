export interface CoverageMetric {
  covered: number;
  total: number;
}

export interface CoverageSummaryEntry {
  lines: CoverageMetric;
}

export type CoverageSummary = Record<string, CoverageSummaryEntry>;

export interface CriticalCoverageConfiguration {
  discoveryRules: Record<string, string[]>;
  domains: Record<string, string[]>;
  schemaVersion: number;
  thresholdLinesPercent: number;
}

export function criticalManifestFailures(
  configuration: CriticalCoverageConfiguration,
  productionFiles: string[],
): string[] {
  const failures: string[] = [];
  const normalizedProductionFiles = productionFiles.map(normalizePath);

  for (const [domain, files] of Object.entries(configuration.domains)) {
    const normalizedFiles = files.map(normalizePath);
    const duplicates = normalizedFiles.filter(
      (file, index) => normalizedFiles.indexOf(file) !== index,
    );
    if (duplicates.length > 0) {
      failures.push(
        `${domain}: duplicate manifest files ${[...new Set(duplicates)].join(', ')}`,
      );
    }

    const rawRules = configuration.discoveryRules[domain];
    if (!rawRules || rawRules.length === 0) {
      failures.push(`${domain}: no discovery rules declared`);
      continue;
    }

    const declaredFiles = new Set(normalizedFiles);
    const compiledRules: RegExp[] = [];
    for (const rawRule of rawRules) {
      let rule: RegExp;
      try {
        rule = new RegExp(rawRule, 'u');
      } catch {
        failures.push(`${domain}: invalid discovery rule ${rawRule}`);
        continue;
      }
      compiledRules.push(rule);
      for (const productionFile of normalizedProductionFiles) {
        if (rule.test(productionFile) && !declaredFiles.has(productionFile)) {
          failures.push(
            `${domain}: discovered critical file is undeclared: ${productionFile}`,
          );
        }
      }
    }

    for (const declaredFile of declaredFiles) {
      if (!compiledRules.some((rule) => rule.test(declaredFile))) {
        failures.push(
          `${domain}: declared critical file is outside discovery rules: ${declaredFile}`,
        );
      }
    }
  }

  for (const domain of Object.keys(configuration.discoveryRules)) {
    if (!(domain in configuration.domains)) {
      failures.push(`${domain}: discovery rules target an unknown domain`);
    }
  }

  return [...new Set(failures)].sort();
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
