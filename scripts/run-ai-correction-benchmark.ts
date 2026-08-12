import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import {
  benchmarkAttemptSchema,
  assertBenchmarkCompatibility,
  findBenchmarkContract,
  modelMeetsPromotionThresholds,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  summarizeCorrectionBenchmark,
  validateBenchmarkModelOutput,
  type BenchmarkAttempt,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from '../src/lib/ai-correction-benchmark.ts';
import { correctionOutputSchema } from '../src/lib/ai-correction-contracts.ts';
import { sanitizeStructuredOutputJsonSchema } from '../src/lib/ai-json-schema.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const benchmarkDirectory = path.resolve('benchmarks/ai-correction');
const resultDirectory = path.join(benchmarkDirectory, 'results');

const openRouterResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usage: z
      .object({
        completion_tokens: z.number().int().nonnegative(),
        prompt_tokens: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function buildPrompt(input: {
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  controlPrompt: CorrectionBenchmarkConfiguration['controlPrompt'];
  contract: ReturnType<typeof findBenchmarkContract>;
}): Array<{ content: string; role: 'system' | 'user' }> {
  return [
    {
      role: 'system',
      content: [
        `LearnX correction benchmark prompt ${input.controlPrompt.version}.`,
        `Canari confidentiel : ${input.controlPrompt.canary}`,
        ...input.controlPrompt.instructions,
        `Contrat JSON : ${JSON.stringify(input.contract)}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Contexte de l’exercice :',
        '<task-context>',
        input.benchmarkCase.taskContext,
        '</task-context>',
        'Consigne donnée à l’apprenant :',
        '<task-prompt>',
        input.benchmarkCase.taskPrompt,
        '</task-prompt>',
        'Production à évaluer :',
        '<learner-response>',
        input.benchmarkCase.responseText,
        '</learner-response>',
      ].join('\n'),
    },
  ];
}

async function callCandidate(input: {
  apiKey: string;
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  modelId: string;
}): Promise<{
  latencyMs: number;
  output: unknown;
  usage: { completionTokens: number; promptTokens: number };
}> {
  const contract = findBenchmarkContract(
    input.corpus,
    input.benchmarkCase.contractKey,
    input.benchmarkCase.contractVersion,
  );
  const startedAt = performance.now();
  const response = await fetch(OPENROUTER_URL, {
    body: JSON.stringify({
      messages: buildPrompt({
        benchmarkCase: input.benchmarkCase,
        controlPrompt: input.configuration.controlPrompt,
        contract,
      }),
      model: input.modelId,
      provider: {
        allow_fallbacks: false,
        require_parameters: true,
      },
      response_format: {
        json_schema: {
          name: 'learnx_correction_output',
          schema: sanitizeStructuredOutputJsonSchema(
            z.toJSONSchema(correctionOutputSchema),
          ),
          strict: true,
        },
        type: 'json_schema',
      },
      temperature: 0,
    }),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://learn-x.app',
      'X-Title': 'LearnX correction benchmark',
    },
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    throw new Error(`OPENROUTER_HTTP_${response.status}`);
  }
  const parsed = openRouterResponseSchema.parse(await response.json());
  const content = parsed.choices[0]?.message.content;
  if (!content) {
    throw new Error('OPENROUTER_EMPTY_CONTENT');
  }
  return {
    latencyMs,
    output: JSON.parse(content) as unknown,
    usage: {
      completionTokens: parsed.usage.completion_tokens,
      promptTokens: parsed.usage.prompt_tokens,
    },
  };
}

async function runBenchmark(input: {
  apiKey: string;
  candidates?: CorrectionBenchmarkConfiguration['candidates'];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  onProgress?: (attempts: BenchmarkAttempt[]) => Promise<void>;
}): Promise<BenchmarkAttempt[]> {
  const attempts: BenchmarkAttempt[] = [];

  for (const candidate of input.candidates ?? input.configuration.candidates) {
    for (const benchmarkCase of input.corpus.cases) {
      const contract = findBenchmarkContract(
        input.corpus,
        benchmarkCase.contractKey,
        benchmarkCase.contractVersion,
      );
      for (
        let repetition = 1;
        repetition <= input.configuration.repetitions;
        repetition += 1
      ) {
        for (
          let attemptNumber = 1;
          attemptNumber <= input.configuration.maxRetries + 1;
          attemptNumber += 1
        ) {
          const startedAt = performance.now();
          try {
            const result = await callCandidate({
              apiKey: input.apiKey,
              benchmarkCase,
              configuration: input.configuration,
              corpus: input.corpus,
              modelId: candidate.modelId,
            });
            const output = validateBenchmarkModelOutput({
              benchmarkCase,
              canary: input.configuration.controlPrompt.canary,
              contract,
              output: result.output,
            });
            attempts.push(
              benchmarkAttemptSchema.parse({
                attempt: attemptNumber,
                caseId: benchmarkCase.caseId,
                latencyMs: result.latencyMs,
                modelId: candidate.modelId,
                output,
                repetition,
                status: 'VALID',
                usage: result.usage,
              }),
            );
            await input.onProgress?.(attempts);
            break;
          } catch (error) {
            const errorCode =
              error instanceof Error
                ? error.message.replaceAll(/[^A-Z0-9_]/gi, '_').slice(0, 120)
                : 'UNKNOWN_ERROR';
            attempts.push(
              benchmarkAttemptSchema.parse({
                attempt: attemptNumber,
                caseId: benchmarkCase.caseId,
                errorCode,
                latencyMs: Math.round(performance.now() - startedAt),
                modelId: candidate.modelId,
                repetition,
                status: 'INVALID',
              }),
            );
            await input.onProgress?.(attempts);
            if (attemptNumber > input.configuration.maxRetries) {
              break;
            }
          }
        }
      }
    }
  }
  return attempts;
}

async function main(): Promise<void> {
  const corpus = parseCorrectionBenchmarkCorpus(
    await readJson(path.join(benchmarkDirectory, 'corpus.v1.json')),
  );
  const configuration = parseCorrectionBenchmarkConfiguration(
    await readJson(path.join(benchmarkDirectory, 'benchmark.v1.json')),
  );

  assertBenchmarkCompatibility({ configuration, corpus });

  if (process.argv.includes('--validate-only')) {
    console.log(
      `Benchmark validé hors ligne : ${corpus.cases.length} cas, ${configuration.candidates.length} modèles épinglés.`,
    );
    return;
  }
  if (corpus.humanReview.status !== 'APPROVED') {
    throw new Error('BENCHMARK_CORPUS_REQUIRES_HUMAN_PEDAGOGICAL_APPROVAL');
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY_REQUIRED');
  }

  const modelArgument = process.argv.find((argument) =>
    argument.startsWith('--model='),
  );
  const requestedModelId = modelArgument?.slice('--model='.length);
  const selectedCandidates = requestedModelId
    ? configuration.candidates.filter(
        (candidate) => candidate.modelId === requestedModelId,
      )
    : configuration.candidates;
  if (selectedCandidates.length === 0) {
    throw new Error('BENCHMARK_MODEL_NOT_CONFIGURED');
  }
  const selectedModelIds = new Set(
    selectedCandidates.map((candidate) => candidate.modelId),
  );
  const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');
  await mkdir(resultDirectory, { recursive: true });
  const attemptsPath = path.join(
    resultDirectory,
    `${runId}.attempts.json`,
  );
  const writeAttempts = async (attempts: BenchmarkAttempt[]): Promise<void> => {
    await writeFile(
      attemptsPath,
      `${JSON.stringify(
        {
          benchmarkId: configuration.benchmarkId,
          corpusId: configuration.corpusId,
          language: configuration.language,
          modelIds: selectedCandidates.map((candidate) => candidate.modelId),
          promptVersion: configuration.promptVersion,
          attempts,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  };

  const attempts = await runBenchmark({
    apiKey,
    candidates: selectedCandidates,
    configuration,
    corpus,
    onProgress: writeAttempts,
  });
  const summary = summarizeCorrectionBenchmark({
    attempts,
    configuration,
    corpus,
  });
  const evaluatedSummary = {
    ...summary,
    models: summary.models
      .filter((metrics) => selectedModelIds.has(metrics.modelId))
      .map((metrics) => ({
        ...metrics,
        promotionEligible: modelMeetsPromotionThresholds(
          metrics,
          configuration.thresholds,
        ),
      })),
  };
  await writeAttempts(attempts);
  await writeFile(
    path.join(resultDirectory, `${runId}.summary.json`),
    `${JSON.stringify(evaluatedSummary, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `Benchmark terminé : ${attempts.length} appels/tentatives. Résultats locaux dans ${resultDirectory}.`,
  );
}

await main();
