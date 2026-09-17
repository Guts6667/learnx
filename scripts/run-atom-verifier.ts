/**
 * V4.5-210 — the atomic verifier measurement.
 *
 * Asks candidate models the narrow blind question on the 60 cards of the 30
 * labelled pairs, three times each, and reads the answers against the
 * pre-declared thresholds (`src/lib/ai-correction-atom-verifier.ts`).
 *
 * Default is a dry run: it writes the plan, every prompt, the scoring key
 * and a cost estimate, and calls nothing. The paid run needs `--run` and
 * `--confirm=mesure` on the command line, and `OPENROUTER_API_KEY` in the
 * environment — exported alone, never by sourcing `.env`. The key is never
 * printed. Spending stops at the cap, and a stopped run is reported as
 * incomplete, never as a result.
 *
 *   pnpm exec tsx scripts/run-atom-verifier.ts                  # dry run
 *   pnpm exec tsx scripts/run-atom-verifier.ts --run --confirm=mesure
 *   options: --reps=3 --models=a,b --cap-usd=3 --concurrency=3
 *   required for paid calls: --envelope-decision=<owner-id> --envelope-usd=<cap>
 * Shared state: Git common directory / learnx-paid-research. Pending or unknown
 * costs and stale locks require explicit reconciliation; no automatic reset.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  assertBlind,
  estimateCostUsd,
  estimateTokens,
  renderVerifierCard,
  selectLabelledPairs,
  summariseModel,
  THRESHOLDS,
  VERIFIER_SYSTEM_PROMPT,
  type KeyEntry,
  type ModelSummary,
  type PairRecord,
  type Pass2Decision,
  type VerifierCard,
} from '../src/lib/ai-correction-atom-verifier.js';

import {
  acquireAtomRunLock,
  openAtomBudget,
  sharedResearchStateDirectory,
} from '../src/lib/ai-correction-atom-verifier-budget.js';
import { executeAtomMeasurement } from '../src/lib/ai-correction-atom-verifier-execution.js';
import {
  ATOM_REQUEST_PROFILE,
  callAtomModel,
  readAtomProviderUsage,
  type AtomCandidate,
} from '../src/lib/ai-correction-atom-verifier-transport.js';

const REG = 'benchmarks/ai-correction/regression';
const OUT_ROOT = path.resolve(REG, 'atom-verifier');
const SEED = 'v4.5-210/atom-verifier/v1';
const COMPLETION_TOKENS_ESTIMATE = 120;
const MAX_OUTPUT_TOKENS = ATOM_REQUEST_PROFILE.maxOutputTokens;
const TIMEOUT_MS = ATOM_REQUEST_PROFILE.timeoutMs;

type Candidate = AtomCandidate;

/**
 * Prices per token. Mistral's comes from the sealed pricing file; the others
 * are read from openrouter.ai on 8 September 2026 and are estimates until
 * the run's `usage.cost` replaces them — the cap is enforced on actual cost
 * when the provider returns one.
 */
function candidates(): Candidate[] {
  const mistral = JSON.parse(
    readFileSync(path.resolve(REG, 'checker-pricing.v1.json'), 'utf8'),
  ) as {
    completionUsdPerToken: number;
    modelId: string;
    promptUsdPerToken: number;
  };
  return [
    {
      id: 'mistral-medium-3-5',
      route: { slug: 'mistral/eu', provider: 'Mistral' },
      modelId: mistral.modelId,
      price: {
        completion: mistral.completionUsdPerToken,
        prompt: mistral.promptUsdPerToken,
      },
      priceSource: 'checker-pricing.v1.json (2026-08-29)',
    },
    {
      id: 'haiku-4-5',
      route: { slug: 'anthropic', provider: 'Anthropic' },
      modelId: 'anthropic/claude-haiku-4.5',
      price: { completion: 0.000005, prompt: 0.000001 },
      priceSource:
        'estimate, openrouter.ai 2026-09-08; actual cost from usage.cost',
    },
    {
      id: 'kimi-k3',
      // No verified non-reasoning route: requires a separately approved profile.
      route: null,
      modelId: 'moonshotai/kimi-k3',
      price: { completion: 0.0000025, prompt: 0.0000006 },
      priceSource:
        'estimate, openrouter.ai 2026-09-08; actual cost from usage.cost',
    },
    {
      id: 'sonnet-4-6',
      route: { slug: 'anthropic', provider: 'Anthropic' },
      modelId: 'anthropic/claude-sonnet-4.6',
      price: { completion: 0.000015, prompt: 0.000003 },
      priceSource:
        'estimate, openrouter.ai 2026-09-08; actual cost from usage.cost',
    },
  ];
}

type Args = {
  capUsd: number;
  concurrency: number;
  confirm: string | null;
  envelopeDecision: string | null;
  envelopeUsd: number | null;
  models: string[] | null;
  reps: number;
  run: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    capUsd: THRESHOLDS.budgetCapUsd,
    concurrency: 3,
    confirm: null,
    envelopeDecision: null,
    envelopeUsd: null,
    models: null,
    reps: THRESHOLDS.repetitions,
    run: false,
  };
  for (const a of argv) {
    if (a === '--run') args.run = true;
    else if (a.startsWith('--confirm=')) args.confirm = a.slice(10);
    else if (a.startsWith('--envelope-decision='))
      args.envelopeDecision = a.slice(20);
    else if (a.startsWith('--envelope-usd='))
      args.envelopeUsd = Number(a.slice(15));
    else if (a.startsWith('--reps=')) args.reps = Number(a.slice(7));
    else if (a.startsWith('--cap-usd=')) args.capUsd = Number(a.slice(10));
    else if (a.startsWith('--concurrency='))
      args.concurrency = Number(a.slice(14));
    else if (a.startsWith('--models=')) args.models = a.slice(9).split(',');
    else throw new Error(`ATOM_VERIFIER_UNKNOWN_ARGUMENT ${a}`);
  }
  if (!Number.isInteger(args.reps) || args.reps < 1 || args.reps > 5) {
    throw new Error('ATOM_VERIFIER_REPS_OUT_OF_RANGE');
  }
  if (!(args.capUsd > 0) || args.capUsd > THRESHOLDS.budgetCapUsd) {
    throw new Error('ATOM_VERIFIER_CAP_ABOVE_PREREGISTRATION');
  }
  if (
    !Number.isInteger(args.concurrency) ||
    args.concurrency < 1 ||
    args.concurrency > 8
  )
    throw new Error('ATOM_CONCURRENCY_OUT_OF_RANGE');
  if (
    args.run &&
    (!args.envelopeDecision?.trim() ||
      !Number.isFinite(args.envelopeUsd) ||
      !(typeof args.envelopeUsd === 'number' && args.envelopeUsd > 0))
  )
    throw new Error('ATOM_EXPLICIT_ENVELOPE_REQUIRED');
  return args;
}

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(path.resolve(REG, file), 'utf8')) as T;
const sha = (text: string): string =>
  'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');

type Case = {
  atomId: string;
  cardId: string;
  pairId: string;
  promptHash: string;
  promptTokensEstimate: number;
  stratum: string;
  userMessage: string;
};

function buildCases() {
  const deck = read<{ cards: VerifierCard[]; manifestHash: string }>(
    'adjudication-deck.v3.json',
  );
  const key = read<{ contentHash: string; key: KeyEntry[] }>(
    'adjudication-deck.v3.key.json',
  );
  const pairs = read<{ contentHash: string; pairs: PairRecord[] }>(
    'adjudication-pairs.v1.json',
  );
  const pass2 = read<{ decisions: Pass2Decision[] }>(
    'adjudication-pass2.owner.2026-09-05.json',
  );
  const pass1 = read<{
    decisions: {
      cardId: string;
      verdict: 'DIRECT' | 'NOT_DIRECT' | 'AMBIGUOUS';
    }[];
  }>('adjudication-pass1.owner.2026-09-05.json');
  const questions = read<{
    contentHash: string;
    questions: Record<string, string>;
  }>('plain-questions.v1.json');
  const labelled = selectLabelledPairs({
    decisions: pass2.decisions,
    key: key.key,
    pairs: pairs.pairs,
  });
  if (labelled.length !== THRESHOLDS.labelledPairs) {
    throw new Error(
      `ATOM_VERIFIER_LABELLED_SET_MISMATCH ${labelled.length} != ${THRESHOLDS.labelledPairs}`,
    );
  }
  const byId = new Map(deck.cards.map((c) => [c.cardId, c]));
  const cases: Case[] = [];
  for (const p of labelled) {
    for (const cardId of [p.originalCardId, p.damagedCardId]) {
      const card = byId.get(cardId);
      if (!card) throw new Error(`ATOM_VERIFIER_CARD_MISSING ${cardId}`);
      const question = questions.questions[card.atomId];
      if (!question)
        throw new Error(`ATOM_VERIFIER_QUESTION_MISSING ${card.atomId}`);
      const userMessage = renderVerifierCard(card, question);
      cases.push({
        atomId: card.atomId,
        cardId,
        pairId: p.pairId,
        promptHash: sha(VERIFIER_SYSTEM_PROMPT + '\n' + userMessage),
        promptTokensEstimate: estimateTokens(
          VERIFIER_SYSTEM_PROMPT + userMessage,
        ),
        stratum: card.stratum,
        userMessage,
      });
    }
  }
  assertBlind(VERIFIER_SYSTEM_PROMPT);
  const pass1Map = new Map(pass1.decisions.map((d) => [d.cardId, d.verdict]));
  return {
    cases,
    hashes: {
      deckHash: deck.manifestHash,
      keyHash: key.contentHash,
      pairsHash: pairs.contentHash,
      questionsHash: questions.contentHash,
      systemPromptHash: sha(VERIFIER_SYSTEM_PROMPT),
    },
    labelled,
    pass1Map,
  };
}

function writePlan(
  dir: string,
  built: ReturnType<typeof buildCases>,
  cands: Candidate[],
  reps: number,
) {
  mkdirSync(path.dirname(dir), { recursive: true });
  mkdirSync(dir); // exclusive: never overwrite a historical plan or run
  mkdirSync(path.join(dir, 'prompts'));
  const promptTokens = built.cases.map((c) => c.promptTokensEstimate);
  const estimates = cands.map((c) => ({
    candidate: c.id,
    estimatedUsd: Number(
      estimateCostUsd({
        completionTokensPerCall: COMPLETION_TOKENS_ESTIMATE,
        price: c.price,
        promptTokens,
        repetitions: reps,
      }).toFixed(4),
    ),
    modelId: c.modelId,
    route: c.route,
    priceSource: c.priceSource,
  }));
  const total = estimates.reduce((a, e) => a + e.estimatedUsd, 0);
  const plan = {
    calls: built.cases.length * cands.length * reps,
    smokeCalls: cands.filter((c) => c.route !== null).length,
    profileVersion: ATOM_REQUEST_PROFILE.version,
    candidates: estimates,
    cards: built.cases.length,
    estimatedTotalUsd: Number(total.toFixed(4)),
    hashes: built.hashes,
    labelledPairs: built.labelled.length,
    repetitions: reps,
    request: {
      reasoning: ATOM_REQUEST_PROFILE.reasoning,
      maxTokens: MAX_OUTPUT_TOKENS,
      provider: {
        allow_fallbacks: false,
        data_collection: 'deny',
        require_parameters: true,
      },
      responseFormat: 'json_schema strict',
      temperature: 0,
      timeoutMs: TIMEOUT_MS,
    },
    schemaVersion: 1,
    seed: SEED,
    thresholds: THRESHOLDS,
  };
  writeFileSync(
    path.join(dir, 'plan.json'),
    JSON.stringify(plan, null, 2) + '\n',
  );
  writeFileSync(
    path.join(dir, 'cases.json'),
    JSON.stringify(
      {
        cases: built.cases.map((c) => ({
          atomId: c.atomId,
          cardId: c.cardId,
          pairId: c.pairId,
          promptHash: c.promptHash,
          promptTokensEstimate: c.promptTokensEstimate,
          stratum: c.stratum,
        })),
        hashes: built.hashes,
        schemaVersion: 1,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    path.join(dir, 'scoring-key.json'),
    JSON.stringify({ pairs: built.labelled, schemaVersion: 1 }, null, 2) + '\n',
  );
  writeFileSync(
    path.join(dir, 'prompts', 'SYSTEM.txt'),
    VERIFIER_SYSTEM_PROMPT + '\n',
  );
  for (const c of built.cases) {
    writeFileSync(
      path.join(dir, 'prompts', `${c.cardId}.txt`),
      c.userMessage + '\n',
    );
  }
  return plan;
}

async function runMeasurement(
  args: Args,
  built: ReturnType<typeof buildCases>,
  cands: Candidate[],
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey?.trim())
    throw new Error(
      'OPENROUTER_API_KEY absent; export it alone, never source .env',
    );
  if (!args.envelopeDecision || args.envelopeUsd === null)
    throw new Error('ATOM_EXPLICIT_ENVELOPE_REQUIRED');
  const shared = sharedResearchStateDirectory();
  const release = acquireAtomRunLock(shared);
  try {
    const usage = await readAtomProviderUsage(apiKey);
    if (usage === null) throw new Error('ATOM_PROVIDER_USAGE_UNMEASURABLE');
    const stamp =
      new Date().toISOString().replace(/[:.]/gu, '-') + '-' + randomUUID();
    const dir = path.join(OUT_ROOT, 'runs', stamp);
    const budget = openAtomBudget({
      directory: shared,
      decisionId: args.envelopeDecision,
      envelopeUsd: args.envelopeUsd,
      keyHash: sha(apiKey),
      providerUsageUsd: usage,
      runCapUsd: args.capUsd,
      runId: stamp,
    });
    const plan = writePlan(dir, built, cands, args.reps);
    const run = await executeAtomMeasurement({
      budget,
      candidates: cands,
      cases: built.cases,
      concurrency: args.concurrency,
      repetitions: args.reps,
      readUsage: () => readAtomProviderUsage(apiKey),
      call: (candidate, userMessage) =>
        callAtomModel({ apiKey, candidate, userMessage }),
      persist: (attempt) =>
        appendFileSync(
          path.join(dir, 'attempts.jsonl'),
          JSON.stringify(attempt) + '\n',
        ),
    });
    const summaries: Record<string, ModelSummary> = {};
    for (const candidate of cands)
      summaries[candidate.id] = summariseModel({
        observations: run.observations.get(candidate.id) ?? [],
        invalidReasons: run.invalidReasons.get(candidate.id),
        pairs: built.labelled,
        pass1: built.pass1Map,
        repetitions: args.reps,
      });
    const summary = {
      schemaVersion: 2,
      complete:
        run.stopped === null &&
        Object.values(summaries).every((s) => s.validity.status === 'MEASURED'),
      plan,
      knownSpentUsd: run.totals.runKnownUsd,
      spentUsd: run.totals.runUnknownCalls ? null : run.totals.runKnownUsd,
      unknownCalls: run.totals.runUnknownCalls,
      stopped: run.stopped,
      summaries,
    };
    writeFileSync(
      path.join(dir, 'summary.json'),
      JSON.stringify(summary, null, 2) + '\n',
      { flag: 'wx' },
    );
    writeFileSync(
      path.join(dir, 'report.md'),
      renderReport(summary, cands, args.reps),
      { flag: 'wx' },
    );
    console.log(
      `${summary.complete ? 'COMPLETE' : 'INCOMPLETE / UNMEASURED'} — known ${summary.knownSpentUsd.toFixed(4)} USD, unknown calls ${summary.unknownCalls} — ${dir}`,
    );
  } finally {
    release();
  }
}

function renderReport(
  summary: {
    complete: boolean;
    spentUsd: number | null;
    knownSpentUsd: number;
    unknownCalls: number;
    stopped: string | null;
    summaries: Record<string, ModelSummary>;
  },
  cands: Candidate[],
  reps: number,
): string {
  const lines = [
    `# Vérificateur atomique — ${summary.complete ? 'mesure' : 'MESURE INCOMPLÈTE'}`,
    '',
    summary.complete
      ? `Run complet. Dépense : ${summary.knownSpentUsd.toFixed(4)} USD.`
      : `Run incomplet : ${summary.stopped ?? 'qualification technique incomplète'}. Coût connu : ${summary.knownSpentUsd.toFixed(4)} USD. Coûts inconnus : ${summary.unknownCalls}. Lire la validité de chaque candidat.`,
    '',
    `Seuils déclarés avant le premier appel : ≥ ${THRESHOLDS.pairwiseProceed}/${THRESHOLDS.labelledPairs} paires gagnées (majorité de ${reps}), ≤ ${THRESHOLDS.flipsProceed} paires instables, rejet des abîmées ≥ ${THRESHOLDS.hardNegativeRejection * 100} %, acceptation des originaux ≥ ${THRESHOLDS.trueEvidenceAcceptance * 100} % ; arrêt sous ${THRESHOLDS.pairwiseStop} paires ou au-delà de ${THRESHOLDS.flipsStop} instables.`,
    '',
    '| modèle | paires gagnées | abîmé | égalité | indécises | instables | rejet abîmées | acceptation originaux | accord passe 1 | non lus | lecture |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const c of cands) {
    const s = summary.summaries[c.id];
    if (!s) continue;
    lines.push(
      `| ${c.modelId} | **${s.pairs.original}** / ${THRESHOLDS.labelledPairs} (${s.clusterUncertainty.clusters} réponses sources) | ${s.pairs.damaged} | ${s.pairs.tie} | ${s.pairs.undecided} | ${s.flips} | ${s.hardNegativeRejection.rejected} / ${s.hardNegativeRejection.denominator} (${s.hardNegativeRejection.abstained} abst.) | ${s.trueEvidenceAcceptance.accepted} / ${s.trueEvidenceAcceptance.denominator} (${s.trueEvidenceAcceptance.abstained} abst.) | ${s.absoluteAgainstPass1 ? `${s.absoluteAgainstPass1.agreements} / ${s.absoluteAgainstPass1.compared}` : '—'} | ${s.unparsed} | ${s.reading} |`,
    );
  }
  for (const c of cands) {
    const s = summary.summaries[c.id];
    if (s)
      lines.push(
        '',
        `${c.id}: ${s.validity.status}; ${s.validity.reasons.join(', ')}. Moyenne par source ${s.clusterUncertainty.clusterWeightedWinRate}; intervalle bootstrap 95 % ${JSON.stringify(s.clusterUncertainty.bootstrap95)}. ${s.clusterUncertainty.limitation}`,
      );
  }
  lines.push(
    '',
    'Les deux taux absolus sont secondaires et toujours rapportés ensemble ; « accord passe 1 » compare le verdict majoritaire au verdict absolu du propriétaire sur la même carte.',
    '',
  );
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = candidates();
  const wanted = args.models;
  const cands = wanted ? all.filter((c) => wanted.includes(c.id)) : all;
  if (wanted?.some((id) => !all.some((c) => c.id === id)))
    throw new Error('ATOM_UNKNOWN_CANDIDATE');
  if (cands.length === 0) throw new Error('ATOM_VERIFIER_NO_CANDIDATE');
  const built = buildCases();
  if (!args.run) {
    const dir = path.join(
      OUT_ROOT,
      'plans',
      new Date().toISOString().replace(/[:.]/gu, '-') + '-' + randomUUID(),
    );
    const plan = writePlan(dir, built, cands, args.reps);
    console.log(`plan écrit : ${dir}`);
    console.log(
      `paires étiquetées : ${built.labelled.length} — cartes : ${built.cases.length} — appels : ${plan.calls}`,
    );
    for (const e of plan.candidates)
      console.log(
        `  ${e.modelId.padEnd(34)} ≈ ${e.estimatedUsd.toFixed(4)} USD (${e.priceSource})`,
      );
    console.log(
      `estimation totale ≈ ${plan.estimatedTotalUsd.toFixed(4)} USD, plafond ${THRESHOLDS.budgetCapUsd} USD`,
    );
    console.log(
      'aucun appel effectué. Pour mesurer : --run --confirm=mesure, avec OPENROUTER_API_KEY exportée seule.',
    );
    return;
  }
  if (args.confirm !== 'mesure') {
    console.error(
      'Le run payant demande --confirm=mesure, sur le mot du propriétaire.',
    );
    process.exit(2);
  }
  await runMeasurement(args, built, cands);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
