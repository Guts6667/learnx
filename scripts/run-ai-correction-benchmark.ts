import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runAiCorrectionBenchmarkCli } from '../src/lib/ai-correction-benchmark-cli.ts';
import { loadBenchmarkInputs as loadInputsForRegression } from '../src/lib/ai-correction-benchmark-runner.ts';
import { callCandidate } from '../src/lib/ai-correction-benchmark-runner.ts';
import {
  runCheckerMeasurement,
  runRegressionAnalysis,
  runRegressionPool,
} from '../src/lib/ai-correction-regression-run-cli.ts';
import type { RegressionCheckerPort } from '../src/lib/ai-correction-regression-run.ts';
import {
  parseCheckerPromptVariant,
  parseFalseAgreeProbe,
  runFalseAgreeProbe,
} from '../src/lib/ai-correction-false-agree-probe.ts';
import { createRuntimeCorrectionChecker } from '../src/server/corrections/correction-checker.ts';
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
  maxRetries: PROMOTED_CORRECTION_IDENTITY.maxRetries,
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
/**
 * Adapts the promoted runtime checker to the suite's port.
 *
 * The runtime checker already resolves every failure to `UNAVAILABLE` rather
 * than to `AGREED` — a checker that is down must cost the HIGH ceiling, never
 * buy a confidence nobody established — so this adapter reshapes and never
 * interprets. Cost passes through untouched so the budget guard reconciles the
 * checker like any other paid call.
 */
function buildRegressionChecker(
  apiKey: string,
  instructions?: readonly string[],
): RegressionCheckerPort {
  const runtime = createRuntimeCorrectionChecker({
    apiKey,
    appUrl: process.env.LEARNX_APP_URL ?? 'https://learnx.local',
    ...(instructions ? { instructions } : {}),
  });
  return {
    async verify({ criteria }) {
      const outcome = await runtime.verify({
        questions: criteria.map((criterion) => ({
          criterionKey: criterion.criterionKey,
          criterionLabel: criterion.criterionLabel,
          levelDescription: criterion.levelDescription,
          levelLabel: criterion.levelLabel,
          quotes: criterion.quotes,
        })),
      });
      return { costUsd: outcome.costUsd, verdicts: outcome.verdicts };
    },
  };
}

async function runAiCorrectionRegressionCli(
  arguments_: string[] = process.argv,
): Promise<void> {
  const { configuration } = await loadInputsForRegression(arguments_);

  // Dispatching is opt-in twice over: the preflight refuses a plan that does
  // not fit its cap, and nothing contacts a provider without --execute. The
  // default of this command therefore cannot spend money by accident.
  const execute = arguments_.includes('--execute');
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (execute && !apiKey) {
    throw new Error(
      'REGRESSION_RUN_API_KEY_REQUIRED: --execute demande OPENROUTER_API_KEY dans l’environnement.',
    );
  }

  // Measuring the verifier's cost replays already-recorded corrections through
  // it: the corrections were paid for once, so this buys only the verifier.
  if (arguments_.some((argument) => argument.startsWith('--measure-checker'))) {
    if (!apiKey) {
      throw new Error(
        'REGRESSION_RUN_API_KEY_REQUIRED: la mesure du vérificateur demande OPENROUTER_API_KEY.',
      );
    }
    const measurement = await runCheckerMeasurement({
      arguments: arguments_,
      checker: buildRegressionChecker(apiKey),
      identities: REGRESSION_PINNED_IDENTITIES,
      providerApiKey: apiKey,
    });
    console.log(
      `Mesure du vérificateur : ${measurement.callsMade} appels, ${measurement.spentUsd.toFixed(6)} USD, ${measurement.resultsDirectory}`,
    );
    return;
  }

  // The designed false-agreement probe. Verifier only: no primary call, no
  // learner response graded. `--dry-run` prices it and validates the cases
  // without contacting anyone, so the bound is known before the spend.
  if (
    arguments_.some((argument) => argument.startsWith('--false-agree-probe'))
  ) {
    const probePath = path.resolve(
      'benchmarks/ai-correction/regression/false-agree-probe.v1.json',
    );
    const probe = parseFalseAgreeProbe(
      JSON.parse(await readFile(probePath, 'utf8')) as unknown,
    );
    // Which instructions the verifier is measured under. Default A: the
    // promoted runtime prompt, so the reference measurement is the system as
    // it ships rather than a variant nobody runs.
    const promptId =
      arguments_
        .find((argument) => argument.startsWith('--checker-prompt='))
        ?.split('=')[1] ?? 'A';
    const variant = parseCheckerPromptVariant(
      JSON.parse(
        await readFile(
          path.resolve(
            `benchmarks/ai-correction/regression/checker-prompts/${promptId}.json`,
          ),
          'utf8',
        ),
      ) as unknown,
    );

    if (!arguments_.includes('--execute')) {
      // Priced under the recorded rate, never a guess: a candidate with no
      // recorded rate cannot be bounded, and is refused rather than estimated.
      const pricing = JSON.parse(
        await readFile(
          path.resolve(
            'benchmarks/ai-correction/regression/checker-pricing.v1.json',
          ),
          'utf8',
        ),
      ) as { modelId: string };
      console.log(
        `Sonde faux accord, à sec — consigne ${variant.id} (${variant.label}) — ${probe.cases.length} cas, ${probe.cases.length} appels vérificateur, aucun appel primaire.`,
      );
      console.log(
        `Vérificateur tarifé : ${pricing.modelId}. Coût mesuré par appel sur la run du 30 août : 0,0011075 USD, soit ${(probe.cases.length * 0.0011075).toFixed(4)} USD pour cette sonde.`,
      );
      console.log(
        `Verdict attendu sur les ${probe.cases.length} : ${probe.expectedVerdict}. Chaque accord est un faux accord.`,
      );
      return;
    }

    if (!apiKey) {
      throw new Error(
        'REGRESSION_RUN_API_KEY_REQUIRED: la sonde demande OPENROUTER_API_KEY.',
      );
    }
    const result = await runFalseAgreeProbe({
      checker: buildRegressionChecker(apiKey, variant.instructions),
      probe,
    });
    const { denominator, numerator, rate } = result.checkerFalseAgreeDesigned;
    console.log(
      `Sonde faux accord, consigne ${variant.id} — ${numerator}/${denominator} faux accords${rate === null ? '' : ` = ${(rate * 100).toFixed(2)} %`}, ${result.costUsd.toFixed(6)} USD.`,
    );
    for (const agreement of result.falseAgreements) {
      console.log(`  accord sur ${agreement.id} — ${agreement.falseBecause}`);
    }
    if (result.unavailable.length > 0) {
      console.log(
        `  ${result.unavailable.length} cas sans verdict, exclus du dénominateur : ${result.unavailable.join(', ')}`,
      );
    }
    return;
  }

  // `--analyse` never dispatches and never needs a key: it measures artefacts
  // a paid run already bought. It is checked before the key is required so a
  // dead run stays analysable on a machine with no credentials.
  if (arguments_.some((argument) => argument.startsWith('--analyse'))) {
    const { analysis, resultsDirectory } = await runRegressionAnalysis({
      arguments: arguments_,
    });
    console.log(`Analyse hors ligne de ${resultsDirectory} — aucun appel.`);
    console.log(
      `${analysis.attempts.length} tentatives, ${analysis.cellsObserved} cellules, ${analysis.cellsUnusable} inexploitables, ${analysis.verdictCount} verdicts réutilisés, ${analysis.ledgerSpentUsd.toFixed(4)} USD au registre.`,
    );
    console.log(
      `Répétitions distinctes : ${analysis.distinctRepetitions.join(', ') || 'aucune'}.`,
    );
    // Printed before the table, not after it. A gate whose metric is missing
    // never reaches the table at all — it is a policy error — so a reader of
    // the table alone would count eleven gates against a twelve-gate policy and
    // see nothing telling them one was skipped.
    if (analysis.malformedCells.length > 0) {
      console.warn(
        `  ${analysis.malformedCells.length} cellules à numérotation incohérente, exclues du dénominateur des preuves (jamais renumérotées) : ${analysis.malformedCells.slice(0, 3).join(', ')}${analysis.malformedCells.length > 3 ? ' …' : ''}`,
      );
    }
    for (const problem of analysis.evaluation.policyErrors) {
      console.warn(`  PROBLÈME DE POLITIQUE  ${problem}`);
    }
    // Declared, not derived: a gate whose metric is missing never reaches the
    // table, so counting the table plus the policy errors would double-count a
    // threshold complaint about a gate that did evaluate. The gap between these
    // two numbers is the thing worth seeing.
    console.log(
      `${analysis.evaluation.gates.length} gates évaluées sur ${analysis.gatesDeclared} déclarées ; promotion ${analysis.evaluation.promotionEligible ? 'éligible' : 'refusée'}.`,
    );
    for (const gate of analysis.evaluation.gates) {
      console.log(
        `  ${gate.status.padEnd(12)} ${gate.kind.padEnd(10)} ${gate.key} — ${gate.numerator}/${gate.denominator}${
          gate.observedRate === null
            ? ' (non mesuré)'
            : ` = ${(gate.observedRate * 100).toFixed(2)} %`
        }`,
      );
    }
    return;
  }

  const outcome = await runRegressionPool({
    arguments: arguments_,
    ...(execute && apiKey
      ? {
          checker: buildRegressionChecker(apiKey),
          executeCandidate: callCandidate,
          providerApiKey: apiKey,
        }
      : {}),
    configuration,
    identities: REGRESSION_PINNED_IDENTITIES,
  });

  console.log(
    outcome.dryRun
      ? `Plan de régression écrit sans aucun appel : ${outcome.resultsDirectory}`
      : `Run de régression terminé : ${outcome.resultsDirectory}`,
  );
  // A resume is judged against what the cap has left, not against the cap: the
  // dispatch guard already carries the inherited spend, so printing the whole
  // cap here would state a headroom the run does not have.
  const capClause =
    outcome.priorActualSpendUsd > 0
      ? `plafond restant ${outcome.remainingCapUsd.toFixed(4)} USD (${outcome.preflight.supplierCostCapUsd} USD moins ${outcome.priorActualSpendUsd.toFixed(4)} USD déjà dépensés)`
      : `plafond ${outcome.preflight.supplierCostCapUsd} USD`;
  console.log(
    `Pool ${outcome.poolSha256.slice(0, 12)}… — ${outcome.plan.corpus.cases.length} unités ; ${outcome.pendingCells} cellules à acheter ; borne totale ${outcome.estimatedPrimaryUsd.toFixed(4)} USD sous ${capClause} — ${outcome.fitsWithinCap ? 'tient dans le plafond' : 'NE TIENT PAS dans le plafond'}.`,
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
  // Every regression-suite entry point routes to the regression CLI. A flag
  // that falls through to the legacy benchmark CLI runs a different command
  // than the one that was typed, which is worse than an unknown-flag error.
  const REGRESSION_FLAGS = [
    '--run-pool',
    '--analyse',
    '--measure-checker',
    '--false-agree-probe',
  ];
  await (process.argv.some((argument) =>
    REGRESSION_FLAGS.some((flag) => argument.startsWith(flag)),
  )
    ? runAiCorrectionRegressionCli()
    : runAiCorrectionBenchmarkCli());
}
