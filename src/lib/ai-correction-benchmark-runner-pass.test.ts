import {
  CorrectionModelOutputError,
  CorrectionProviderError,
} from './ai-correction-provider-adapters';
import { executeBenchmarkWorkflowPass } from './ai-correction-benchmark-runner-pass';

const benchmarkMocks = vi.hoisted(() => ({
  attemptParse: vi.fn((value: unknown) => value),
  salvage: vi.fn(),
  validate: vi.fn(),
}));
const contractMocks = vi.hoisted(() => ({ canonicalize: vi.fn() }));

vi.mock('./ai-correction-benchmark', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai-correction-benchmark')>()),
  benchmarkAttemptSchema: { parse: benchmarkMocks.attemptParse },
  salvageProtocol3PartialCorrection: benchmarkMocks.salvage,
  validateBenchmarkProtocol3ModelOutputWithEvidence: benchmarkMocks.validate,
}));

vi.mock('./ai-correction-contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ai-correction-contracts')>()),
  canonicalizeProtocol3CorrectionOutput: contractMocks.canonicalize,
}));

type PassInput = Parameters<typeof executeBenchmarkWorkflowPass>[0];

const providerResult = {
  latencyMs: 42,
  modelSnapshot: 'model-snapshot',
  output: { criteria: [] },
  providerRequestId: 'request-1',
  providerRoute: 'provider-route',
  usage: { actualCostUsd: 0.01, costSource: 'ACTUAL' },
};

function input(overrides: Partial<PassInput> = {}): PassInput {
  return {
    apiKey: 'test-key',
    attemptNumber: 1,
    benchmarkCase: {
      caseId: 'case-1',
      contractKey: 'contract-1',
      contractVersion: '1',
    },
    candidate: {
      candidateId: 'candidate-1',
      modelId: 'model-1',
      provider: 'provider-1',
      requestProfile: { version: '1' },
    },
    configuration: {
      controlPrompt: { canary: 'CANARY' },
      correctionDeliveryPolicy: 'ALL_OR_NOTHING',
      requestProtocolVersion: '3',
    },
    contract: { criteria: [] },
    corpus: { cases: [] },
    executeCandidate: vi.fn().mockResolvedValue(providerResult),
    repetition: 2,
    workflowPass: 'PRIMARY',
    ...overrides,
  } as PassInput;
}

describe('benchmark workflow pass', () => {
  beforeEach(() => {
    benchmarkMocks.attemptParse.mockClear();
    benchmarkMocks.salvage.mockReset();
    benchmarkMocks.validate.mockReset();
    contractMocks.canonicalize.mockReset();
  });

  it('publie une sortie valide et ses preuves résolues', async () => {
    benchmarkMocks.validate.mockReturnValue({
      evidenceMatches: [{ quote: 'preuve' }],
      output: { criteria: [{ criterionKey: 'criterion-1' }] },
    });

    await expect(executeBenchmarkWorkflowPass(input())).resolves.toMatchObject({
      evidenceMatches: [{ quote: 'preuve' }],
      status: 'VALID',
      workflowPass: 'PRIMARY',
    });
    expect(benchmarkMocks.salvage).not.toHaveBeenCalled();
  });

  it('sauve les critères livrables sous la politique partielle', async () => {
    benchmarkMocks.validate.mockImplementation(() => {
      throw new Error('MODEL_EVIDENCE_NOT_IN_RESPONSE');
    });
    benchmarkMocks.salvage.mockReturnValue({
      evidenceMatches: [],
      output: { criteria: [] },
      unsureCriteria: ['criterion-1'],
    });

    await expect(
      executeBenchmarkWorkflowPass(
        input({
          configuration: {
            controlPrompt: { canary: 'CANARY' },
            correctionDeliveryPolicy: 'PARTIAL_CRITERION',
            requestProtocolVersion: '3',
          } as unknown as PassInput['configuration'],
        }),
      ),
    ).resolves.toMatchObject({
      status: 'VALID',
      unsureCriteria: ['criterion-1'],
    });
  });

  it('préserve une sortie structurée invalide lorsque le sauvetage échoue', async () => {
    benchmarkMocks.validate.mockImplementation(() => {
      throw new Error('MODEL_EVIDENCE_AMBIGUOUS_IN_RESPONSE');
    });
    benchmarkMocks.salvage.mockImplementation(() => {
      throw new Error('nothing safe');
    });
    contractMocks.canonicalize.mockReturnValue({ criteria: [] });

    await expect(
      executeBenchmarkWorkflowPass(
        input({
          configuration: {
            controlPrompt: { canary: 'CANARY' },
            correctionDeliveryPolicy: 'PARTIAL_CRITERION',
            requestProtocolVersion: '3',
          } as unknown as PassInput['configuration'],
        }),
      ),
    ).resolves.toMatchObject({
      errorCode: 'MODEL_EVIDENCE_AMBIGUOUS_IN_RESPONSE',
      output: { criteria: [] },
      status: 'INVALID',
    });
  });

  it('omet la sortie non canonique sous le contrat tout-ou-rien', async () => {
    benchmarkMocks.validate.mockImplementation(() => {
      throw 'invalid output';
    });
    contractMocks.canonicalize.mockImplementation(() => {
      throw new Error('not canonical');
    });

    await expect(executeBenchmarkWorkflowPass(input())).resolves.toMatchObject({
      errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
      output: undefined,
      status: 'INVALID',
    });
    expect(benchmarkMocks.salvage).not.toHaveBeenCalled();
  });

  it('propage une erreur inattendue du transport', async () => {
    const failure = new Error('unexpected');
    await expect(
      executeBenchmarkWorkflowPass(
        input({ executeCandidate: vi.fn().mockRejectedValue(failure) }),
      ),
    ).rejects.toBe(failure);
  });

  it('normalise une erreur HTTP fournisseur avec statut', async () => {
    const failure = new CorrectionProviderError('PROVIDER_HTTP_ERROR', {
      latencyMs: 20,
      providerRequestId: 'request-error',
      status: 429,
    });
    await expect(
      executeBenchmarkWorkflowPass(
        input({ executeCandidate: vi.fn().mockRejectedValue(failure) }),
      ),
    ).resolves.toMatchObject({
      errorCode: 'PROVIDER_HTTP_429',
      status: 'ERROR',
    });
  });

  it('conserve le code fournisseur lorsqu’aucun statut HTTP n’existe', async () => {
    const failure = new CorrectionProviderError('PROVIDER_TIMEOUT');
    await expect(
      executeBenchmarkWorkflowPass(
        input({ executeCandidate: vi.fn().mockRejectedValue(failure) }),
      ),
    ).resolves.toMatchObject({
      errorCode: 'PROVIDER_TIMEOUT',
      status: 'ERROR',
    });
  });

  it('classe une erreur de sortie modèle comme invalide avec son brut et son coût', async () => {
    const failure = new CorrectionModelOutputError('MODEL_OUTPUT_TRUNCATED', {
      rawModelOutput: '{"partial":',
      usage: {
        actualCostUsd: 0.02,
        costSource: 'ACTUAL',
        inputTokens: 10,
        reasoningTokens: 0,
        visibleOutputTokens: 5,
      },
    });
    await expect(
      executeBenchmarkWorkflowPass(
        input({ executeCandidate: vi.fn().mockRejectedValue(failure) }),
      ),
    ).resolves.toMatchObject({
      errorCode: 'MODEL_OUTPUT_TRUNCATED',
      rawModelOutput: '{"partial":',
      status: 'INVALID',
      usage: { actualCostUsd: 0.02 },
    });
  });
});
