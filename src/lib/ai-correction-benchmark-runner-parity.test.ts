import { describe, expect, it, vi } from 'vitest';

import { runAiCorrectionBenchmarkCli } from './ai-correction-benchmark-cli.ts';
import { loadBenchmarkInputs } from './ai-correction-benchmark-runner.ts';

const validationMessage =
  'Benchmark validé hors ligne : 24 cas, 12 modèles épinglés.';

const goldenConfigurations = [
  {
    arguments: [],
    authority: 'HUMAN',
    benchmarkId: 'learnx-french-text-correction-v1',
    configurationSha256:
      'c551bee8c10c23e90991854aabdda252f92ce0c243d8ac29aba0c4b473424ae7',
    corpusId: 'learnx-french-text-corpus-v1-3',
    corpusSha256:
      'a78393edbeb6b350fcd8f1d5bb8931c9ddebd8e69cf15e852bc038129c9eb73c',
    supplierCostCapUsd: undefined,
  },
  {
    arguments: [
      '--benchmark-configuration=benchmarks/ai-correction/benchmark.v2.json',
    ],
    authority: 'HUMAN',
    benchmarkId: 'learnx-french-text-correction-v2',
    configurationSha256:
      '7613bd42fa6d2b7a84ee6ee695a73ea152f2d15a4ebceab9e584298fca65682b',
    corpusId: 'learnx-french-text-corpus-v1-3',
    corpusSha256:
      'a78393edbeb6b350fcd8f1d5bb8931c9ddebd8e69cf15e852bc038129c9eb73c',
    supplierCostCapUsd: undefined,
  },
  {
    arguments: [
      '--configuration=benchmarks/ai-correction/holdout.benchmark.v3.json',
    ],
    authority: 'HUMAN',
    benchmarkId: 'learnx-french-text-correction-holdout-v3',
    configurationSha256:
      'bc288bd8665101764bb5e8f2d4ab2f3c3abf916202741e00328a25eccb46aa0a',
    corpusId: 'learnx-french-text-holdout-v2',
    corpusSha256:
      '2a74db971138b62b2d059c299876a16c40375d4bd4c1f247f86f62564fefb571',
    supplierCostCapUsd: undefined,
  },
  {
    arguments: [
      '--configuration=benchmarks/ai-correction/hybrid/writing-only-fr-v1/configuration.contingency-4usd.json',
    ],
    authority: 'AUTONOMOUS_AI_NOT_HUMAN',
    benchmarkId: 'learnx-french-writing-correction-sonnet-v3-1-guarded-v1',
    configurationSha256:
      'ecef1238cace1d88ab5cb455b00f9cee398bf8c4c3e37b4ca3e15a158650e51c',
    corpusId: 'learnx-french-writing-holdout-v1',
    corpusSha256:
      '13ef1e6f696ef71ff7da1371bb263c7b3858d6ec737f1f4f6e44ede15b802e22',
    supplierCostCapUsd: 4,
  },
] as const;

describe('AI correction benchmark runner parity', () => {
  it.each(goldenConfigurations)(
    'preserves the configuration identity for $benchmarkId',
    async (golden) => {
      const loaded = await loadBenchmarkInputs([
        'node',
        'run-ai-correction-benchmark.ts',
        ...golden.arguments,
      ]);

      expect({
        authority: loaded.corpusReviewAuthority,
        benchmarkId: loaded.configuration.benchmarkId,
        candidateCount: loaded.configuration.candidates.length,
        caseCount: loaded.corpus.cases.length,
        configurationSha256: loaded.configurationSha256,
        corpusId: loaded.corpus.corpusId,
        corpusSha256: loaded.corpusSha256,
        supplierCostCapUsd: loaded.supplierCostCapUsd,
      }).toEqual({
        authority: golden.authority,
        benchmarkId: golden.benchmarkId,
        candidateCount: 12,
        caseCount: 24,
        configurationSha256: golden.configurationSha256,
        corpusId: golden.corpusId,
        corpusSha256: golden.corpusSha256,
        supplierCostCapUsd: golden.supplierCostCapUsd,
      });
    },
  );

  it.each(goldenConfigurations)(
    'keeps validate-only offline for $benchmarkId',
    async (golden) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runAiCorrectionBenchmarkCli([
        'node',
        'run-ai-correction-benchmark.ts',
        '--validate-only',
        ...golden.arguments,
      ]);

      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(validationMessage);
      log.mockRestore();
    },
  );

  it('does not execute the public CLI when it is imported', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.resetModules();

    await import('../../scripts/run-ai-correction-benchmark.ts');

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
