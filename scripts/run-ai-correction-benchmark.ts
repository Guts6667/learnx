import { applyResearchPriceCeilings } from '../src/lib/ai-correction-research-guarded-fetch.ts';
import {
  withGuardedResearchRun,
  readResearchProviderUsage,
} from '../src/lib/ai-correction-research-run.ts';
import { sharedResearchStateDirectory } from '../src/lib/ai-correction-atom-verifier-budget.ts';
import { runDesignedCheckerProbe } from '../src/lib/ai-correction-regression-probe-cli.ts';
import { designedCheckerIdentity } from '../src/lib/ai-correction-regression-probe-evidence.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { runAiCorrectionBenchmarkCli } from '../src/lib/ai-correction-benchmark-cli.ts';
import { loadBenchmarkInputs as loadInputsForRegression } from '../src/lib/ai-correction-benchmark-runner.ts';
import { callCandidate } from '../src/lib/ai-correction-benchmark-runner.ts';
import {
  checkerPricingSchema,
  runRegressionAnalysis,
  runRegressionPool,
} from '../src/lib/ai-correction-regression-run-cli.ts';
import type { RegressionCheckerPort } from '../src/lib/ai-correction-regression-run.ts';
import {
  parseFalseAgreeProbe,
  parseCheckerPromptVariant,
} from '../src/lib/ai-correction-false-agree-probe.ts';
import {
  buildCheckerRequestBody,
  createRuntimeCorrectionChecker,
  DEFAULT_CHECKER_INSTRUCTIONS,
} from '../src/server/corrections/correction-checker.ts';
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
  fetchImplementation?: typeof fetch,
): RegressionCheckerPort {
  const runtime = createRuntimeCorrectionChecker({
    apiKey,
    appUrl: process.env.LEARNX_APP_URL ?? 'https://learnx.local',
    ...(instructions ? { instructions } : {}),
    ...(fetchImplementation ? { fetchImplementation } : {}),
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
  const execute =
    arguments_.includes('--execute') && !arguments_.includes('--dry-run');
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (execute && !apiKey) {
    throw new Error(
      'REGRESSION_RUN_API_KEY_REQUIRED: --execute demande OPENROUTER_API_KEY dans l’environnement.',
    );
  }

  if (arguments_.some((argument) => argument.startsWith('--measure-checker'))) {
    throw new Error(
      'REGRESSION_MEASURE_CHECKER_RETIRED: use --false-agree-probe with explicit --execute and a shared envelope.',
    );
  }
  const pricing = checkerPricingSchema.parse(
    JSON.parse(
      await readFile(
        path.resolve(
          'benchmarks/ai-correction/regression/checker-pricing.v1.json',
        ),
        'utf8',
      ),
    ) as unknown,
  );
  const checkerModel = {
    ...pricing,
    maxOutputTokens:
      PROMOTED_CHECKER_IDENTITY.requestProfile.totalOutputTokenLimit,
  };
  const frozenProbe = parseFalseAgreeProbe(
    JSON.parse(
      await readFile(
        path.resolve(
          'benchmarks/ai-correction/regression/false-agree-probe.v1.json',
        ),
        'utf8',
      ),
    ) as unknown,
  );
  const executableCheckerProfile = (instructions: readonly string[]) => ({
    routeProviders: PROMOTED_CHECKER_IDENTITY.requestProfile.routeProviders,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    method: 'POST',
    redirect: 'error',
    timeoutMs: PROMOTED_CHECKER_IDENTITY.requestProfile.timeoutMs,
    // Actual renderer, schema, temperature and provider policy; no claimed reasoning setting absent from the wire.
    requests: frozenProbe.cases.map((entry) => ({
      id: entry.id,
      body: applyResearchPriceCeilings(
        buildCheckerRequestBody(
          [
            {
              criterionKey: entry.criterionKey,
              criterionLabel: entry.criterionLabel,
              levelDescription: entry.levelDescription,
              levelLabel: entry.levelLabel,
              quotes: entry.quotes,
            },
          ],
          instructions,
        ),
        checkerModel,
      ),
    })),
  });
  const defaultProfile = executableCheckerProfile(DEFAULT_CHECKER_INSTRUCTIONS);
  const identities = {
    ...REGRESSION_PINNED_IDENTITIES,
    checkerQualificationIdentity: designedCheckerIdentity({
      modelId: pricing.modelId,
      instructions: DEFAULT_CHECKER_INSTRUCTIONS,
      requestProfile: defaultProfile,
    }),
  };

  // The designed false-agreement probe. Verifier only: no primary call, no
  // learner response graded. `--dry-run` prices it and validates the cases
  // without contacting anyone, so the bound is known before the spend.
  if (
    arguments_.some((argument) => argument.startsWith('--false-agree-probe'))
  ) {
    const option = (name: string) =>
      arguments_
        .find((argument) => argument.startsWith(`--${name}=`))
        ?.slice(name.length + 3);
    const qualificationRunId = option('qualification-run-id');
    if (!qualificationRunId)
      throw new Error('DESIGNED_PROBE_QUALIFICATION_RUN_ID_REQUIRED');
    const promptId = option('checker-prompt') ?? 'A';
    if (!/^[A-Za-z0-9-]+$/.test(promptId))
      throw new Error('DESIGNED_PROBE_PROMPT_ID_INVALID');
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
    const executableProfile = executableCheckerProfile(variant.instructions);
    const checker = designedCheckerIdentity({
      modelId: pricing.modelId,
      requestProfile: executableProfile,
      instructions: variant.instructions,
    });
    const allowedRequests = new Set(
      executableProfile.requests.map((entry) => JSON.stringify(entry.body)),
    );
    // Research-only price ceilings; production request bodies are untouched.
    const pricedCheckerFetch: typeof fetch = async (resource, init) => {
      const request = new Request(resource, init);
      const body = applyResearchPriceCeilings(
        JSON.parse(await request.text()) as unknown,
        checkerModel,
      );
      const serialized = JSON.stringify(body);
      if (
        request.url !== executableProfile.endpoint ||
        request.method !== 'POST' ||
        !allowedRequests.has(serialized)
      )
        throw new Error('DESIGNED_PROBE_EXECUTABLE_PROFILE_MISMATCH');
      return fetch(
        new Request(request, { body: serialized, redirect: 'error' }),
      );
    };
    const result = await runDesignedCheckerProbe({
      arguments: arguments_,
      binding: {
        checker,
        qualificationRunId,
        measurementKind: 'LIVE',
        simulatesValidatedFamily: arguments_.includes(
          '--simulate-validated-family',
        ),
      },
      instructions: variant.instructions,
      executableProfile,
      ...(apiKey
        ? {
            checker: buildRegressionChecker(
              apiKey,
              variant.instructions,
              pricedCheckerFetch,
            ),
            apiKey,
          }
        : {}),
      budgetDirectory: sharedResearchStateDirectory(),
      probePath: path.resolve(
        'benchmarks/ai-correction/regression/false-agree-probe.v1.json',
      ),
      outputDirectory: path.resolve(
        'benchmarks/ai-correction/regression/probes',
        new Date().toISOString().replace(/[:.]/g, '-'),
      ),
      pricing,
      maxOutputTokens:
        PROMOTED_CHECKER_IDENTITY.requestProfile.totalOutputTokenLimit,
      readProviderUsage: () =>
        apiKey
          ? readResearchProviderUsage(apiKey, fetch)
          : Promise.resolve(null),
    });
    console.log(
      `Designed probe: reserved bound ${result.reservedBoundUsd.toFixed(6)} USD; ${result.evidencePath ?? 'dry run, no calls'}`,
    );

    return;
  }

  // `--analyse` never dispatches and never needs a key: it measures artefacts
  // a paid run already bought. It is checked before the key is required so a
  // dead run stays analysable on a machine with no credentials.
  if (arguments_.some((argument) => argument.startsWith('--analyse'))) {
    const { analysis, resultsDirectory, poolBinding } =
      await runRegressionAnalysis({
        arguments: arguments_,
      });
    console.log(
      `Ré-analyse versionnée hors ligne de ${resultsDirectory} — lien pool ${poolBinding}, politique source ${analysis.sourceGatePolicyVersion ?? 'inconnue'}, politique appliquée ${analysis.gatePolicyVersion}, simulation famille validée ${analysis.simulatesValidatedFamily}, aucun appel.`,
    );
    console.log(
      `${analysis.attempts.length} tentatives, ${analysis.cellsObserved} cellules, ${analysis.cellsUnusable} inexploitables, ${analysis.verdictCount} verdicts liés, ${analysis.legacyUnboundVerdictCount} verdicts historiques non liés (inutilisables), ${analysis.ledgerSpentUsd.toFixed(4)} USD au registre.`,
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

  const executeRun = (
    guard?: Parameters<
      Parameters<typeof withGuardedResearchRun>[0]['execute']
    >[0],
  ) =>
    runRegressionPool({
      arguments: arguments_,
      configuration,
      identities,
      ...(execute && apiKey && guard
        ? {
            checker: buildRegressionChecker(apiKey, undefined, guard.fetch),
            executeCandidate: (input) =>
              callCandidate({ ...input, fetchImplementation: guard.fetch }),
            providerApiKey: apiKey,
            beforeFinalization: guard.assertReconciled,
          }
        : {}),
    });
  const primary = configuration.candidates.find(
    (candidate) => candidate.candidateId === identities.primaryCandidateId,
  );
  if (!primary) throw new Error('REGRESSION_PRIMARY_PRICE_MISSING');
  const outcome =
    execute && !arguments_.includes('--dry-run') && apiKey
      ? await withGuardedResearchRun({
          arguments: arguments_,
          apiKey,
          runId: `regression:${new Date().toISOString()}`,
          models: [
            checkerModel,
            {
              modelId: primary.modelId,
              promptUsdPerToken: primary.promptUsdPerToken,
              completionUsdPerToken: primary.completionUsdPerToken,
              maxOutputTokens: primary.requestProfile.totalOutputTokenLimit,
            },
          ],
          execute: executeRun,
        })
      : await executeRun();

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
