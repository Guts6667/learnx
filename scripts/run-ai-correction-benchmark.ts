import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runAiCorrectionBenchmarkCli } from '../src/lib/ai-correction-benchmark-cli.ts';

export {
  assertAutonomousSupplierCostReconciled,
  buildBenchmarkSupplierBudgetPreflight,
  loadBenchmarkInputs,
  mergeAutonomousHoldoutBenchmarkConfiguration,
  parseAutonomousHoldoutConfiguration,
  runBenchmark,
  type BenchmarkSupplierBudgetPreflight,
} from '../src/lib/ai-correction-benchmark-runner.ts';

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await runAiCorrectionBenchmarkCli();
}
