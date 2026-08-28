import type {
  BenchmarkAttempt,
  BenchmarkSummary,
  CorrectionBenchmarkConfiguration,
  CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark';
import {
  createBenchmarkCliWriters,
  writeBenchmarkBlindReviewPacket,
  writeBenchmarkSummary,
} from './ai-correction-benchmark-cli-output';
import type {
  BenchmarkSupplierBudgetPreflight,
  LoadedBenchmarkInputs,
} from './ai-correction-benchmark-runner';
import type { BenchmarkCliSelection } from './ai-correction-benchmark-cli-selection';

const fileSystem = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    ...fileSystem,
    default: { ...actual, ...fileSystem },
  };
});

const candidate = {
  candidateId: 'candidate-a',
  modelId: 'model-a',
  provider: 'provider-a',
  requestProfile: { version: '1' },
};
const benchmarkCase = {
  caseId: 'case-source-1',
  contractKey: 'contract-a',
  contractVersion: '1',
  responseText: 'Réponse étudiante',
  taskContext: 'Contexte',
  taskPrompt: 'Consigne',
};
const configuration = {
  benchmarkId: 'benchmark-a',
  corpusId: 'corpus-a',
  language: 'fr-FR',
  promptVersion: '1',
  requestProtocolVersion: '3',
} as unknown as CorrectionBenchmarkConfiguration;
const corpus = { corpusId: 'corpus-a' } as unknown as CorrectionBenchmarkCorpus;
const loaded = {
  configurationSha256: 'a'.repeat(64),
  corpusReviewAuthority: 'NONE',
  corpusSha256: 'b'.repeat(64),
  supplierCostCapUsd: 4,
} as unknown as LoadedBenchmarkInputs;

function selection(
  overrides: Partial<BenchmarkCliSelection> = {},
): BenchmarkCliSelection {
  return {
    reviewPanelMode: false,
    runMetadata: { mode: 'SMOKE' },
    runMode: 'SMOKE',
    selectedCandidates: [candidate],
    selectedCases: [benchmarkCase],
    ...overrides,
  } as BenchmarkCliSelection;
}

function writtenJson(callIndex = 0): Record<string, unknown> {
  const contents = fileSystem.writeFile.mock.calls[callIndex]?.[1];
  if (typeof contents !== 'string') {
    throw new Error('Expected a serialized JSON artifact.');
  }
  return JSON.parse(contents) as Record<string, unknown>;
}

describe('benchmark CLI output artifacts', () => {
  beforeEach(() => {
    fileSystem.mkdir.mockReset().mockResolvedValue(undefined);
    fileSystem.writeFile.mockReset().mockResolvedValue(undefined);
  });

  it('crée un nouveau stem et sérialise une campagne sans budget', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T10:11:12.345Z'));
    const writers = await createBenchmarkCliWriters({
      configuration,
      loaded,
      selection: selection(),
    });

    expect(writers.outputStem).toMatch(/2026-08-28T10-11-12-345Z$/);
    await writers.writeAttempts([]);
    expect(writtenJson()).toMatchObject({
      benchmarkId: 'benchmark-a',
      modelIds: ['model-a'],
      supplierBudget: null,
    });
    vi.useRealTimers();
  });

  it('reprend le stem existant et détecte uniquement les coûts non réconciliés', async () => {
    const budget = {
      actualSpentUsd: 0.2,
      hardCapUsd: 1,
    };
    const writers = await createBenchmarkCliWriters({
      configuration,
      loaded,
      selection: selection({
        resumePath: '/tmp/existing.attempts.json',
        supplierBudget:
          budget as unknown as BenchmarkCliSelection['supplierBudget'],
      }),
    });
    const attempts = [
      {
        errorCode: 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET',
        usage: { costSource: 'ESTIMATED' },
      },
      { usage: { actualCostUsd: 0.2, costSource: 'ACTUAL' } },
    ] as BenchmarkAttempt[];

    expect(writers.outputStem).toBe('/tmp/existing');
    await writers.writeAttempts(attempts);
    expect(writtenJson()).toMatchObject({
      supplierBudget: { reconciliationRequired: false },
    });

    await writers.writeAttempts([
      { usage: { actualCostUsd: 0.2, costSource: 'ESTIMATED' } },
    ] as BenchmarkAttempt[]);
    expect(writtenJson(1)).toMatchObject({
      supplierBudget: { reconciliationRequired: true },
    });
  });

  it('lie le préflight autonome à 72 primaires et à la politique optionnelle', async () => {
    const autonomousLoaded = {
      ...loaded,
      budgetPolicyPath: '/tmp/budget.json',
      budgetPolicySha256: 'c'.repeat(64),
      corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
    } as LoadedBenchmarkInputs;
    const writers = await createBenchmarkCliWriters({
      configuration,
      loaded: autonomousLoaded,
      selection: selection(),
    });
    const preflight = { primaryCallCount: 72 } as BenchmarkSupplierBudgetPreflight;

    await writers.writeBudgetPreflight(preflight);
    expect(writtenJson()).toMatchObject({
      budgetPolicyPath: '/tmp/budget.json',
      budgetPolicySha256: 'c'.repeat(64),
      configurationSha256: 'a'.repeat(64),
    });
    await expect(
      writers.writeBudgetPreflight({
        ...preflight,
        primaryCallCount: 71,
      }),
    ).rejects.toThrow('BENCHMARK_AUTONOMOUS_PRIMARY_CELL_COUNT_INVALID');
  });

  it('utilise le nombre de cellules restantes lors d’une reprise autonome', async () => {
    const writers = await createBenchmarkCliWriters({
      configuration,
      loaded: {
        ...loaded,
        corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
      } as LoadedBenchmarkInputs,
      selection: selection({
        resumeState: { pendingCells: [{}, {}] },
      } as Partial<BenchmarkCliSelection>),
    });

    await expect(
      writers.writeBudgetPreflight({
        primaryCallCount: 2,
      } as BenchmarkSupplierBudgetPreflight),
    ).resolves.toBeUndefined();
  });

  it('n’écrit aucun paquet aveugle hors panel de revue', async () => {
    await writeBenchmarkBlindReviewPacket({
      attempts: [],
      configuration,
      corpus,
      outputStem: '/tmp/run',
      selection: selection(),
    });
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it('anonymise les cas et retient la dernière tentative disponible', async () => {
    const attempts = [
      { attempt: 1, caseId: 'case-source-1', repetition: 1, status: 'INVALID' },
      { attempt: 2, caseId: 'case-source-1', repetition: 1, status: 'VALID' },
      { attempt: 1, caseId: 'other-case', repetition: 1, status: 'VALID' },
    ] as BenchmarkAttempt[];
    await writeBenchmarkBlindReviewPacket({
      attempts,
      configuration,
      corpus,
      outputStem: '/tmp/run',
      selection: selection({
        reviewPanelMode: true,
        selectedCases: [
          benchmarkCase,
          { ...benchmarkCase, caseId: 'missing' },
        ] as unknown as BenchmarkCliSelection['selectedCases'],
      }),
    });

    const artifact = writtenJson();
    const cases = artifact.cases as Array<Record<string, unknown>>;
    expect(cases[0]?.benchmarkCase).toMatchObject({ caseId: 'case-1' });
    expect(cases[0]?.result).toMatchObject({ attempt: 2, status: 'VALID' });
    expect(cases[1]?.result).toBeUndefined();
  });

  it('ajoute le snapshot budgétaire au résumé', async () => {
    await writeBenchmarkSummary({
      attempts: [{ usage: { costSource: 'ESTIMATED' } }] as BenchmarkAttempt[],
      outputStem: '/tmp/run',
      selection: selection({
        supplierBudget: {
          actualSpentUsd: 0.1,
          hardCapUsd: 1,
        } as unknown as BenchmarkCliSelection['supplierBudget'],
      }),
      summary: { benchmarkId: 'benchmark-a' } as unknown as BenchmarkSummary,
    });
    expect(writtenJson()).toMatchObject({
      benchmarkId: 'benchmark-a',
      supplierBudget: { reconciliationRequired: true },
    });
  });
});
