import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runAiCorrectionBenchmarkCli } from '../src/lib/ai-correction-benchmark-cli.ts';
import { loadBenchmarkInputs as loadInputsForRegression } from '../src/lib/ai-correction-benchmark-runner.ts';
import { runRegressionPool } from '../src/lib/ai-correction-regression-run-cli.ts';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from '../src/server/corrections/promoted-identity.ts';

/**
 * The identities a regression run may measure (spec §4).
 *
 * This script is the only place they are read: `src/lib` must not import
 * `src/server`, so the pinning is composed here and passed down, where
 * `selectPinnedCandidate` refuses anything else. The suite runs through this
 * same entry point rather than a parallel runner, as spec §1 requires.
 *
 * Kept module-local rather than exported: the script's public runtime facade is
 * pinned by `ai-correction-benchmark-runner-parity.test.ts`, and a new entry
 * point is no reason to widen a surface other code was promised.
 */
const REGRESSION_PINNED_IDENTITIES = {
  checkerModelId: PROMOTED_CHECKER_IDENTITY.modelId,
  primaryCandidateId: PROMOTED_CORRECTION_IDENTITY.candidateId,
  primaryModelId: PROMOTED_CORRECTION_IDENTITY.modelId,
};

/**
 * `--run-pool` — plan, price and lay out a regression run.
 *
 * No provider executor is wired here: V4.5-121 supplies one with the owner's
 * authorisation in hand. Until then the command is free and prints what a paid
 * run would cost.
 */
async function runAiCorrectionRegressionCli(
  arguments_: string[] = process.argv,
): Promise<void> {
  const { configuration } = await loadInputsForRegression(arguments_);
  const outcome = await runRegressionPool({
    arguments: arguments_,
    configuration,
    identities: REGRESSION_PINNED_IDENTITIES,
  });

  console.log(
    outcome.dryRun
      ? `Plan de régression écrit sans aucun appel : ${outcome.resultsDirectory}`
      : `Run de régression terminé : ${outcome.resultsDirectory}`,
  );
  console.log(
    `Pool ${outcome.poolSha256.slice(0, 12)}… — ${outcome.plan.corpus.cases.length} unités ; borne primaire ${outcome.estimatedPrimaryUsd.toFixed(4)} USD sous plafond ${outcome.preflight.supplierCostCapUsd} USD (décision ${outcome.preflight.decision}).`,
  );
  for (const refusal of outcome.paraphraseRefusals) {
    console.warn(`Paraphrase écartée — ${refusal.caseId} : ${refusal.reason}`);
  }
}

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
  await (process.argv.some((argument) => argument.startsWith('--run-pool'))
    ? runAiCorrectionRegressionCli()
    : runAiCorrectionBenchmarkCli());
}
