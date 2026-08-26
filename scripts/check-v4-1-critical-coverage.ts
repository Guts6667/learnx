import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  criticalCoverageFailures,
  evaluateCriticalCoverage,
  type CoverageSummary,
  type CriticalCoverageConfiguration,
} from '../src/lib/v4-1-critical-coverage.ts';

const mode = process.argv.includes('--final') ? 'final' : 'report';
const projectRoot = process.cwd();
const configurationPath = resolve(
  projectRoot,
  'quality/v4-1-critical-domains.json',
);
const summaryPath = resolve(projectRoot, 'coverage/coverage-summary.json');

if (!existsSync(summaryPath)) {
  throw new Error(
    'Coverage summary is missing. Run coverage before this gate.',
  );
}

const configuration = JSON.parse(
  readFileSync(configurationPath, 'utf8'),
) as CriticalCoverageConfiguration;
const summary = JSON.parse(
  readFileSync(summaryPath, 'utf8'),
) as CoverageSummary;
const results = evaluateCriticalCoverage(configuration, summary, projectRoot);

for (const result of results) {
  console.log(
    `${result.name}: ${result.percent.toFixed(2)}% lines (${result.covered}/${result.total}); ${result.files - result.missingFiles.length}/${result.files} files measured`,
  );
  for (const missingFile of result.missingFiles) {
    console.log(`  missing: ${missingFile}`);
  }
}

const failures = criticalCoverageFailures(
  results,
  configuration.thresholdLinesPercent,
);
if (failures.length > 0) {
  const message = failures.join('\n');
  if (mode === 'final') throw new Error(message);
  console.warn(`Critical coverage is not release-ready:\n${message}`);
}
