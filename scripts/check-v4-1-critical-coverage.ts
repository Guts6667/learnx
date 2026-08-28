import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import {
  criticalCoverageFailures,
  criticalManifestFailures,
  evaluateCriticalCoverage,
  type CoverageSummary,
  type CriticalCoverageConfiguration,
} from '../src/lib/v4-1-critical-coverage.ts';
import {
  assertV4_1CriticalCoveragePolicy,
  isV4_1TestSupportPath,
} from '../src/lib/v4-1-coverage-policy.ts';

const mode = process.argv.includes('--final') ? 'final' : 'report';
const projectRoot = process.cwd();
const configurationPath = resolve(
  projectRoot,
  'quality/v4-1-critical-domains.json',
);
const summaryPath = resolve(projectRoot, 'coverage/coverage-summary.json');

function collectProductionFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectProductionFiles(path);
    if (!['.ts', '.tsx'].includes(extname(path))) return [];
    if (path.endsWith('.d.ts') || /\.test\.[cm]?tsx?$/u.test(path)) return [];
    const normalizedPath = relative(projectRoot, path).replaceAll('\\', '/');
    if (isV4_1TestSupportPath(normalizedPath)) return [];
    return [normalizedPath];
  });
}

if (!existsSync(summaryPath)) {
  throw new Error(
    'Coverage summary is missing. Run coverage before this gate.',
  );
}

const configuration = JSON.parse(
  readFileSync(configurationPath, 'utf8'),
) as CriticalCoverageConfiguration;
assertV4_1CriticalCoveragePolicy(configuration.thresholdLinesPercent);
const summary = JSON.parse(
  readFileSync(summaryPath, 'utf8'),
) as CoverageSummary;
const results = evaluateCriticalCoverage(configuration, summary, projectRoot);
const manifestFailures = criticalManifestFailures(
  configuration,
  collectProductionFiles(resolve(projectRoot, 'src')),
);

for (const result of results) {
  console.log(
    `${result.name}: ${result.percent.toFixed(2)}% lines (${result.covered}/${result.total}); ${result.files - result.missingFiles.length}/${result.files} files measured`,
  );
  for (const missingFile of result.missingFiles) {
    console.log(`  missing: ${missingFile}`);
  }
}

const failures = [
  ...manifestFailures,
  ...criticalCoverageFailures(results, configuration.thresholdLinesPercent),
];
if (failures.length > 0) {
  const message = failures.join('\n');
  if (mode === 'final') throw new Error(message);
  console.warn(`Critical coverage is not release-ready:\n${message}`);
}
