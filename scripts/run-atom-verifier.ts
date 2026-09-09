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
 */
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  assertBlind,
  binomialUpperTail,
  estimateCostUsd,
  estimateTokens,
  parseVerifierAnswer,
  renderVerifierCard,
  seededShuffle,
  selectLabelledPairs,
  summariseModel,
  THRESHOLDS,
  VERIFIER_JSON_SCHEMA,
  VERIFIER_SYSTEM_PROMPT,
  type CardObservation,
  type KeyEntry,
  type ModelSummary,
  type PairRecord,
  type Pass2Decision,
  type PriceUsdPerToken,
  type VerifierCard,
} from '../src/lib/ai-correction-atom-verifier.js';

const REG = 'benchmarks/ai-correction/regression';
const OUT_ROOT = path.resolve(REG, 'atom-verifier');
const SEED = 'v4.5-210/atom-verifier/v1';
const COMPLETION_TOKENS_ESTIMATE = 120;
const MAX_OUTPUT_TOKENS = 400;
const TIMEOUT_MS = 60_000;

type Candidate = {
  id: string;
  modelId: string;
  price: PriceUsdPerToken;
  priceSource: string;
};

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
      modelId: mistral.modelId,
      price: {
        completion: mistral.completionUsdPerToken,
        prompt: mistral.promptUsdPerToken,
      },
      priceSource: 'checker-pricing.v1.json (2026-08-29)',
    },
    {
      id: 'haiku-4-5',
      modelId: 'anthropic/claude-haiku-4.5',
      price: { completion: 0.000005, prompt: 0.000001 },
      priceSource:
        'estimate, openrouter.ai 2026-09-08; actual cost from usage.cost',
    },
    {
      id: 'kimi-k3',
      modelId: 'moonshotai/kimi-k3',
      price: { completion: 0.0000025, prompt: 0.0000006 },
      priceSource:
        'estimate, openrouter.ai 2026-09-08; actual cost from usage.cost',
    },
    {
      id: 'sonnet-4-6',
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
  models: string[] | null;
  reps: number;
  run: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    capUsd: THRESHOLDS.budgetCapUsd,
    concurrency: 3,
    confirm: null,
    models: null,
    reps: THRESHOLDS.repetitions,
    run: false,
  };
  for (const a of argv) {
    if (a === '--run') args.run = true;
    else if (a.startsWith('--confirm=')) args.confirm = a.slice(10);
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
  mkdirSync(path.join(dir, 'prompts'), { recursive: true });
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
    priceSource: c.priceSource,
  }));
  const total = estimates.reduce((a, e) => a + e.estimatedUsd, 0);
  const plan = {
    calls: built.cases.length * cands.length * reps,
    candidates: estimates,
    cards: built.cases.length,
    estimatedTotalUsd: Number(total.toFixed(4)),
    hashes: built.hashes,
    labelledPairs: built.labelled.length,
    repetitions: reps,
    request: {
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

type LedgerLine = {
  attempt: number;
  candidateId: string;
  cardId: string;
  costSource: 'ACTUAL' | 'ESTIMATED';
  costUsd: number;
  errorCode: string | null;
  latencyMs: number;
  modelId: string;
  providerRoute: string | null;
  repetition: number;
  status: 'VALID' | 'UNPARSED' | 'ERROR';
};

async function callModel(input: {
  apiKey: string;
  candidate: Candidate;
  userMessage: string;
}): Promise<{
  content: string | null;
  costUsd: number | null;
  errorCode: string | null;
  latencyMs: number;
  promptTokens: number;
  providerRoute: string | null;
  completionTokens: number;
}> {
  const started = performance.now();
  const body = {
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { content: VERIFIER_SYSTEM_PROMPT, role: 'system' },
      { content: input.userMessage, role: 'user' },
    ],
    model: input.candidate.modelId,
    provider: {
      allow_fallbacks: false,
      data_collection: 'deny',
      require_parameters: true,
    },
    response_format: {
      json_schema: {
        name: 'learnx_atom_verdict',
        schema: VERIFIER_JSON_SCHEMA,
        strict: true,
      },
      type: 'json_schema',
    },
    temperature: 0,
    usage: { include: true },
  };
  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://learn-x.app',
        'X-Title': 'LearnX atom verifier V4.5-210',
      },
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return {
      completionTokens: 0,
      content: null,
      costUsd: null,
      errorCode:
        name === 'TimeoutError' || name === 'AbortError'
          ? 'PROVIDER_TIMEOUT'
          : 'PROVIDER_NETWORK_ERROR',
      latencyMs: Math.round(performance.now() - started),
      promptTokens: 0,
      providerRoute: null,
    };
  }
  const latencyMs = Math.round(performance.now() - started);
  const text = await response.text();
  if (!response.ok) {
    return {
      completionTokens: 0,
      content: null,
      costUsd: null,
      errorCode: `HTTP_${response.status}`,
      latencyMs,
      promptTokens: 0,
      providerRoute: null,
    };
  }
  let payload: {
    choices?: { finish_reason?: string; message?: { content?: string } }[];
    provider?: string;
    usage?: {
      completion_tokens?: number;
      cost?: number;
      prompt_tokens?: number;
    };
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    return {
      completionTokens: 0,
      content: null,
      costUsd: null,
      errorCode: 'ENVELOPE_INVALID',
      latencyMs,
      promptTokens: 0,
      providerRoute: null,
    };
  }
  const choice = payload.choices?.[0];
  return {
    completionTokens: payload.usage?.completion_tokens ?? 0,
    content: choice?.message?.content ?? null,
    costUsd:
      typeof payload.usage?.cost === 'number' ? payload.usage.cost : null,
    errorCode:
      choice?.finish_reason === 'length' ? 'MODEL_OUTPUT_TRUNCATED' : null,
    latencyMs,
    promptTokens: payload.usage?.prompt_tokens ?? 0,
    providerRoute: payload.provider ?? null,
  };
}

async function runMeasurement(
  args: Args,
  built: ReturnType<typeof buildCases>,
  cands: Candidate[],
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error(
      'OPENROUTER_API_KEY absent : exporter cette seule variable, sans sourcer .env.',
    );
    process.exit(2);
  }
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const dir = path.join(OUT_ROOT, 'runs', stamp);
  if (existsSync(dir)) throw new Error('ATOM_VERIFIER_RUN_DIR_EXISTS');
  const plan = writePlan(dir, built, cands, args.reps);
  const ledgerPath = path.join(dir, 'ledger.jsonl');
  const responsesPath = path.join(dir, 'responses.jsonl');
  const caseById = new Map(built.cases.map((c) => [c.cardId, c]));

  // Work list: every (candidate, repetition) gets its own seeded order, so
  // neither position nor neighbour is shared across repetitions.
  const work: { candidate: Candidate; cardId: string; repetition: number }[] =
    [];
  for (const candidate of cands) {
    for (let r = 1; r <= args.reps; r += 1) {
      const order = seededShuffle(
        built.cases.map((c) => c.cardId),
        createHash('sha256')
          .update(`${SEED}/${candidate.id}/rep-${r}`)
          .digest('hex'),
      );
      for (const cardId of order)
        work.push({ candidate, cardId, repetition: r });
    }
  }

  let spentUsd = 0;
  let stopped: string | null = null;
  const observations = new Map<string, CardObservation[]>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < work.length && stopped === null) {
      const item = work[cursor];
      cursor += 1;
      if (!item) return;
      const c = caseById.get(item.cardId);
      if (!c) throw new Error(`ATOM_VERIFIER_CASE_MISSING ${item.cardId}`);
      const projected =
        c.promptTokensEstimate * item.candidate.price.prompt +
        COMPLETION_TOKENS_ESTIMATE * item.candidate.price.completion;
      if (spentUsd + projected > args.capUsd) {
        stopped = `BUDGET_CAP ${args.capUsd} USD reached at ${spentUsd.toFixed(4)} USD`;
        return;
      }
      const result = await callModel({
        apiKey,
        candidate: item.candidate,
        userMessage: c.userMessage,
      });
      const estimated =
        result.promptTokens * item.candidate.price.prompt +
        result.completionTokens * item.candidate.price.completion;
      const costUsd =
        result.costUsd ?? (result.errorCode ? 0 : estimated || projected);
      spentUsd += costUsd;
      const parsed = result.content
        ? parseVerifierAnswer(result.content)
        : null;
      const line: LedgerLine = {
        attempt: 1,
        candidateId: item.candidate.id,
        cardId: item.cardId,
        costSource: result.costUsd === null ? 'ESTIMATED' : 'ACTUAL',
        costUsd,
        errorCode: result.errorCode,
        latencyMs: result.latencyMs,
        modelId: item.candidate.modelId,
        providerRoute: result.providerRoute,
        repetition: item.repetition,
        status: result.errorCode ? 'ERROR' : parsed ? 'VALID' : 'UNPARSED',
      };
      appendFileSync(ledgerPath, JSON.stringify(line) + '\n');
      appendFileSync(
        responsesPath,
        JSON.stringify({
          candidateId: item.candidate.id,
          cardId: item.cardId,
          content: result.content,
          parsed,
          promptHash: c.promptHash,
          repetition: item.repetition,
        }) + '\n',
      );
      const list = observations.get(item.candidate.id) ?? [];
      list.push({
        cardId: item.cardId,
        repetition: item.repetition,
        verdict: parsed?.verdict ?? null,
      });
      observations.set(item.candidate.id, list);
      process.stdout.write(
        `${item.candidate.id} r${item.repetition} ${item.cardId} ${line.status} ${parsed?.verdict ?? '-'} ${spentUsd.toFixed(4)} USD\n`,
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, args.concurrency) }, worker),
  );

  const summaries: Record<string, ModelSummary> = {};
  for (const candidate of cands) {
    summaries[candidate.id] = summariseModel({
      observations: observations.get(candidate.id) ?? [],
      pairs: built.labelled,
      pass1: built.pass1Map,
      repetitions: args.reps,
    });
  }
  const complete = stopped === null && cursor >= work.length;
  const summary = {
    complete,
    plan: { calls: plan.calls, estimatedTotalUsd: plan.estimatedTotalUsd },
    schemaVersion: 1,
    spentUsd: Number(spentUsd.toFixed(6)),
    stopped,
    summaries,
  };
  writeFileSync(
    path.join(dir, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
  );
  writeFileSync(
    path.join(dir, 'report.md'),
    renderReport(summary, cands, args.reps),
  );
  console.log(
    `\n${complete ? 'run complet' : 'RUN INCOMPLET — ' + stopped} — ${spentUsd.toFixed(4)} USD — ${dir}`,
  );
}

function renderReport(
  summary: {
    complete: boolean;
    spentUsd: number;
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
      ? `Run complet. Dépense : ${summary.spentUsd.toFixed(4)} USD.`
      : `Run arrêté : ${summary.stopped}. Dépense : ${summary.spentUsd.toFixed(4)} USD. Aucun résultat ci-dessous ne vaut verdict.`,
    '',
    `Seuils déclarés avant le premier appel : ≥ ${THRESHOLDS.pairwiseProceed}/${THRESHOLDS.labelledPairs} paires gagnées (majorité de ${reps}), ≤ ${THRESHOLDS.flipsProceed} paires instables, rejet des abîmées ≥ ${THRESHOLDS.hardNegativeRejection * 100} %, acceptation des originaux ≥ ${THRESHOLDS.trueEvidenceAcceptance * 100} % ; arrêt sous ${THRESHOLDS.pairwiseStop} paires ou au-delà de ${THRESHOLDS.flipsStop} instables.`,
    '',
    '| modèle | paires gagnées | abîmé | égalité | indécises | instables | rejet abîmées | acceptation originaux | accord passe 1 | non lus | lecture |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const c of cands) {
    const s = summary.summaries[c.id];
    if (!s) continue;
    const p = binomialUpperTail(
      s.pairs.original + s.pairs.damaged,
      s.pairs.original,
    );
    lines.push(
      `| ${c.modelId} | **${s.pairs.original}** / ${THRESHOLDS.labelledPairs} (p = ${p.toExponential(1)} sur ${s.pairs.original + s.pairs.damaged} tranchées) | ${s.pairs.damaged} | ${s.pairs.tie} | ${s.pairs.undecided} | ${s.flips} | ${s.hardNegativeRejection.rejected} / ${s.hardNegativeRejection.denominator} (${s.hardNegativeRejection.abstained} abst.) | ${s.trueEvidenceAcceptance.accepted} / ${s.trueEvidenceAcceptance.denominator} (${s.trueEvidenceAcceptance.abstained} abst.) | ${s.absoluteAgainstPass1 ? `${s.absoluteAgainstPass1.agreements} / ${s.absoluteAgainstPass1.compared}` : '—'} | ${s.unparsed} | ${summary.complete ? s.reading : '—'} |`,
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
  if (cands.length === 0) throw new Error('ATOM_VERIFIER_NO_CANDIDATE');
  const built = buildCases();
  if (!args.run) {
    const dir = path.join(OUT_ROOT, 'plan.v1');
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
