import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  autonomousCorpusReviewMetadata,
  fullResumeArtifact,
} from './ai-correction-benchmark.test-support.js';
import { selectBenchmarkCliRun } from './ai-correction-benchmark-cli-selection.js';
import {
  loadBenchmarkInputs,
  type LoadedBenchmarkInputs,
} from './ai-correction-benchmark-runner.js';

describe('selectBenchmarkCliRun', () => {
  let loaded: LoadedBenchmarkInputs;

  beforeAll(async () => {
    loaded = await loadBenchmarkInputs([
      'node',
      'run-ai-correction-benchmark.ts',
    ]);
  });

  function firstCandidate() {
    const candidate = loaded.configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected a benchmark candidate.');
    }
    return candidate;
  }

  function firstCase() {
    const benchmarkCase = loaded.corpus.cases[0];
    if (!benchmarkCase) {
      throw new Error('Expected a benchmark case.');
    }
    return benchmarkCase;
  }

  function selectionInput(
    arguments_: string[],
    overrides: Partial<LoadedBenchmarkInputs> = {},
  ) {
    const effectiveLoaded = { ...loaded, ...overrides };
    return {
      arguments: arguments_,
      configuration: effectiveLoaded.configuration,
      corpus: effectiveLoaded.corpus,
      loaded: effectiveLoaded,
    };
  }

  it('selects the complete configured campaign by default', async () => {
    const selection = await selectBenchmarkCliRun(selectionInput([]));

    expect(selection.runMode).toBe('FULL');
    expect(selection.requestDelayMs).toBe(0);
    expect(selection.selectedCandidates).toEqual(
      loaded.configuration.candidates,
    );
    expect(selection.selectedCases).toEqual(loaded.corpus.cases);
    expect(selection.runMetadata.repetitions).toBe(
      loaded.configuration.repetitions,
    );
    expect(selection.supplierBudget).toBeUndefined();
  });

  it('selects a single smoke case and applies its operational limits', async () => {
    const candidate = firstCandidate();
    const benchmarkCase = firstCase();
    const selection = await selectBenchmarkCliRun(
      selectionInput([
        `--candidate=${candidate.candidateId}`,
        `--case=${benchmarkCase.caseId}`,
        '--delay-ms=250',
        '--supplier-cost-cap-usd=0.5',
      ]),
    );

    expect(selection.runMode).toBe('SMOKE');
    expect(selection.requestDelayMs).toBe(250);
    expect(selection.requestedCaseId).toBe(benchmarkCase.caseId);
    expect(selection.selectedCandidates).toEqual([candidate]);
    expect(selection.selectedCases).toEqual([benchmarkCase]);
    expect(selection.runMetadata.repetitions).toBe(1);
    expect(selection.supplierBudget?.hardCapUsd).toBe(0.5);
  });

  it('keeps every configured provider route when filtering by model', async () => {
    const modelId = 'moonshotai/kimi-k3';
    const expectedCandidates = loaded.configuration.candidates.filter(
      (candidate) => candidate.modelId === modelId,
    );

    const selection = await selectBenchmarkCliRun(
      selectionInput([`--model=${modelId}`]),
    );

    expect(expectedCandidates.length).toBeGreaterThan(1);
    expect(selection.selectedCandidates).toEqual(expectedCandidates);
  });

  it('selects the preregistered review panel for exactly one candidate', async () => {
    const candidate = firstCandidate();
    const selection = await selectBenchmarkCliRun(
      selectionInput([
        `--candidate=${candidate.candidateId}`,
        '--review-panel',
      ]),
    );

    expect(selection.runMode).toBe('REVIEW_PANEL');
    expect(selection.reviewPanelMode).toBe(true);
    expect(selection.selectedCases.map((item) => item.caseId)).toEqual(
      loaded.configuration.reviewPanelCaseIds,
    );
    expect(selection.runMetadata.repetitions).toBe(1);
  });

  it.each(['-1', '30001', 'not-a-number'])(
    'rejects an invalid request delay of %s',
    async (delay) => {
      await expect(
        selectBenchmarkCliRun(selectionInput([`--delay-ms=${delay}`])),
      ).rejects.toThrow('BENCHMARK_DELAY_MS_INVALID');
    },
  );

  it.each(['0', 'not-a-number'])(
    'rejects an invalid supplier cap of %s',
    async (cap) => {
      await expect(
        selectBenchmarkCliRun(
          selectionInput([`--supplier-cost-cap-usd=${cap}`]),
        ),
      ).rejects.toThrow('SUPPLIER_BUDGET_CAP_INVALID');
    },
  );

  it('rejects ambiguous, unknown and unsafe panel filters', async () => {
    const candidate = firstCandidate();

    await expect(
      selectBenchmarkCliRun(
        selectionInput([
          `--candidate=${candidate.candidateId}`,
          `--model=${candidate.modelId}`,
        ]),
      ),
    ).rejects.toThrow('BENCHMARK_FILTER_AMBIGUOUS');
    await expect(
      selectBenchmarkCliRun(selectionInput(['--candidate=missing'])),
    ).rejects.toThrow('BENCHMARK_MODEL_NOT_CONFIGURED');
    await expect(
      selectBenchmarkCliRun(selectionInput(['--review-panel'])),
    ).rejects.toThrow('BENCHMARK_REVIEW_PANEL_REQUIRES_ONE_MODEL');
  });

  it('rejects missing panel and explicitly requested cases', async () => {
    const candidate = firstCandidate();
    const configuration = {
      ...loaded.configuration,
      reviewPanelCaseIds: ['missing-case'],
    };

    await expect(
      selectBenchmarkCliRun({
        ...selectionInput([]),
        arguments: [
          `--candidate=${candidate.candidateId}`,
          '--review-panel',
        ],
        configuration,
        loaded: { ...loaded, configuration },
      }),
    ).rejects.toThrow('BENCHMARK_REVIEW_PANEL_CASE_MISSING');
    await expect(
      selectBenchmarkCliRun(
        selectionInput([
          `--candidate=${candidate.candidateId}`,
          '--case=missing-case',
        ]),
      ),
    ).rejects.toThrow('BENCHMARK_CASE_NOT_CONFIGURED');
  });

  it('enforces an authorized candidate and immutable supplier cap', async () => {
    const [authorizedCandidate, otherCandidate] =
      loaded.configuration.candidates;
    if (!authorizedCandidate || !otherCandidate) {
      throw new Error('Expected at least two benchmark candidates.');
    }
    const authority = {
      authorizedCandidateId: authorizedCandidate.candidateId,
      supplierCostCapUsd: 0.5,
    };

    await expect(
      selectBenchmarkCliRun(
        selectionInput([`--candidate=${otherCandidate.candidateId}`], authority),
      ),
    ).rejects.toThrow('BENCHMARK_AUTONOMOUS_CANDIDATE_IDENTITY_MISMATCH');
    await expect(
      selectBenchmarkCliRun(
        selectionInput(['--supplier-cost-cap-usd=0.25'], authority),
      ),
    ).rejects.toThrow('BENCHMARK_AUTONOMOUS_SUPPLIER_CAP_IDENTITY_MISMATCH');

    const selection = await selectBenchmarkCliRun(selectionInput([], authority));
    expect(selection.selectedCandidates).toEqual([authorizedCandidate]);
    expect(selection.supplierBudget?.hardCapUsd).toBe(0.5);
  });

  it('allows only a complete single OpenRouter campaign under autonomous authority', async () => {
    const candidate = firstCandidate();
    const corpusReview = {
      ...autonomousCorpusReviewMetadata(),
      configurationSha256: loaded.configurationSha256,
      corpusSha256: loaded.corpusSha256,
    };
    const authority: Partial<LoadedBenchmarkInputs> = {
      authorizedCandidateId: candidate.candidateId,
      corpusReview,
      corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
      supplierCostCapUsd: 0.5,
    };

    const selection = await selectBenchmarkCliRun(selectionInput([], authority));
    expect(selection.runMetadata.corpusReviewAuthority).toBe(
      'AUTONOMOUS_AI_NOT_HUMAN',
    );
    expect(selection.runMetadata.reviewAuthority).toBe('NONE');

    await expect(
      selectBenchmarkCliRun(
        selectionInput([`--case=${firstCase().caseId}`], authority),
      ),
    ).rejects.toThrow(
      'BENCHMARK_AUTONOMOUS_RUN_REQUIRES_FULL_SINGLE_ACTUAL_COST_CANDIDATE',
    );

    const incompatibleCandidate = {
      ...candidate,
      requestProfile: {
        ...candidate.requestProfile,
        adapter: 'OPENAI_RESPONSES' as const,
      },
    };
    const configuration = {
      ...loaded.configuration,
      candidates: [incompatibleCandidate],
    };
    await expect(
      selectBenchmarkCliRun({
        arguments: [],
        configuration,
        corpus: loaded.corpus,
        loaded: { ...loaded, ...authority, configuration },
      }),
    ).rejects.toThrow(
      'BENCHMARK_AUTONOMOUS_RUN_REQUIRES_FULL_SINGLE_ACTUAL_COST_CANDIDATE',
    );
  });

  it('resumes only from an unfiltered attempts artifact', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'learnx-resume-'));
    const resumePath = path.join(directory, 'campaign.attempts.json');
    await writeFile(
      resumePath,
      JSON.stringify(
        fullResumeArtifact({
          configuration: loaded.configuration,
          corpus: loaded.corpus,
        }),
      ),
    );

    const selection = await selectBenchmarkCliRun(
      selectionInput([`--resume=${resumePath}`]),
    );
    expect(selection.runMode).toBe('FULL');
    expect(selection.resumePath).toBe(resumePath);
    expect(selection.selectedCandidates).toEqual([firstCandidate()]);

    await expect(
      selectBenchmarkCliRun(
        selectionInput([
          `--resume=${resumePath}`,
          `--case=${firstCase().caseId}`,
        ]),
      ),
    ).rejects.toThrow('BENCHMARK_RESUME_FILTERS_FORBIDDEN');
    await expect(
      selectBenchmarkCliRun(selectionInput(['--resume=campaign.json'])),
    ).rejects.toThrow('BENCHMARK_RESUME_PATH_INVALID');
  });
});
