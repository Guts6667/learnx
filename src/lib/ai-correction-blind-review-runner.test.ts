import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  benchmarkAttemptSchema,
  benchmarkResumeArtifactSchema,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark';
import {
  assertFullBlindReviewPacketMatchesSources,
  buildFullBlindReviewPacket,
  correctionBenchmarkConfigurationSha256,
  parseAutonomousBlindReviewPacket,
} from '../../scripts/generate-ai-correction-full-blind-review';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fullRunFixture() {
  const configuration = parseCorrectionBenchmarkConfiguration(
    JSON.parse(
      readFileSync('benchmarks/ai-correction/benchmark.v1.json', 'utf8'),
    ) as unknown,
  );
  const corpusRaw = readFileSync(
    'benchmarks/ai-correction/corpus.v1.json',
    'utf8',
  );
  const corpus = parseCorrectionBenchmarkCorpus(
    JSON.parse(corpusRaw) as unknown,
  );
  const candidate = configuration.candidates[0];
  if (!candidate) throw new Error('Expected benchmark candidate.');
  const contractsByKey = new Map(
    corpus.contracts.map((contract) => [
      `${contract.contractKey}|${contract.version}`,
      contract,
    ]),
  );
  const attempts = corpus.cases.flatMap((benchmarkCase) => {
    const contract = contractsByKey.get(
      `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
    );
    if (!contract) throw new Error('Expected benchmark contract.');
    const output = {
      contractKey: contract.contractKey,
      contractVersion: contract.version,
      criteria: benchmarkCase.expectedCriteria.map((expected) => ({
        confidence: 0.9,
        criterionKey: expected.criterionKey,
        evidenceQuotes: [benchmarkCase.responseText.slice(0, 12)],
        feedback: 'Retour candidat visible.',
        levelKey: expected.levelKey,
      })),
      overallConfidence: 0.9,
      overallFeedback: 'Retour candidat visible.',
      secondPass: { reasons: [], required: false },
    };
    return Array.from({ length: configuration.repetitions }, (_, index) =>
      benchmarkAttemptSchema.parse({
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: benchmarkCase.caseId,
        latencyMs: 1,
        modelId: candidate.modelId,
        output,
        repetition: index + 1,
        requestProfileSnapshot: candidate.requestProfile,
        requestProtocolVersion: configuration.requestProtocolVersion,
        status: 'VALID',
      }),
    );
  });
  const configurationSha256 = correctionBenchmarkConfigurationSha256({
    configuration,
  });
  const corpusSha256 = sha256(corpusRaw);
  const artifact = benchmarkResumeArtifactSchema.parse({
    attempts,
    benchmarkId: configuration.benchmarkId,
    candidates: [
      {
        candidateId: candidate.candidateId,
        modelId: candidate.modelId,
        provider: candidate.provider,
        requestProfile: candidate.requestProfile,
      },
    ],
    configurationSha256,
    corpusId: corpus.corpusId,
    corpusSha256,
    language: configuration.language,
    mode: 'FULL',
    modelIds: [candidate.modelId],
    promptVersion: configuration.promptVersion,
    requestProtocolVersion: configuration.requestProtocolVersion,
    runMetadata: {
      candidateIds: [candidate.candidateId],
      caseIds: corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
      configurationSha256,
      corpusSha256,
      humanReview: { reviewedAt: null, reviewer: null, status: 'PENDING' },
      mode: 'FULL',
      repetitions: configuration.repetitions,
    },
  });
  return {
    artifact,
    attemptsSha256: 'a'.repeat(64),
    configuration,
    configurationSha256,
    corpus,
    corpusSha256,
  };
}

describe('autonomous blind review packet', () => {
  it('reconstructs the packet and rejects forged content or empty cases', () => {
    const sources = fullRunFixture();
    const packet = buildFullBlindReviewPacket(sources).packet;
    expect(packet.cases.length).toBeGreaterThan(0);
    const forged = structuredClone(packet);
    const firstCase = forged.cases[0];
    if (!firstCase) throw new Error('Expected blind review case.');
    firstCase.submission.taskPrompt = `${firstCase.submission.taskPrompt} forgé`;
    expect(() =>
      assertFullBlindReviewPacketMatchesSources({ ...sources, packet: forged }),
    ).toThrow('BLIND_REVIEW_PACKET_SOURCE_RECONSTRUCTION_MISMATCH');
    expect(() =>
      parseAutonomousBlindReviewPacket({ ...packet, cases: [] }),
    ).toThrow();
  });

  it('exposes only neutral candidate outputs and bounded invalid raw output', () => {
    const sources = fullRunFixture();
    const first = sources.artifact.attempts[0];
    if (!first) throw new Error('Expected benchmark attempt.');
    const artifact = benchmarkResumeArtifactSchema.parse({
      ...sources.artifact,
      attempts: [
        benchmarkAttemptSchema.parse({
          ...first,
          errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
          output: undefined,
          rawModelOutput: '{"malformed":true}',
          status: 'INVALID',
        }),
        { ...first, attempt: 2 },
        ...sources.artifact.attempts.slice(1),
      ],
    });
    const packet = buildFullBlindReviewPacket({ ...sources, artifact }).packet;
    const serialized = JSON.stringify(packet);
    for (const forbidden of [
      'attempt',
      'errorCode',
      'evidenceMatches',
      'status',
      'unsureCriteria',
      'modelId',
      'provider',
      'usage',
      'actualCostUsd',
      'goldRationale',
      'verdict',
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
    const retryCase = packet.cases.find(
      (reviewCase) => reviewCase.candidateResponses.length === 2,
    );
    expect(retryCase?.candidateResponses).toMatchObject([
      { ordinal: 1, rawOutput: '{"malformed":true}' },
      { ordinal: 2, output: expect.any(Object) },
    ]);
  });

  it('binds the autonomous supplier cap into the configuration digest', () => {
    const { configuration } = fullRunFixture();
    expect(
      correctionBenchmarkConfigurationSha256({
        configuration,
        supplierCostCapUsd: 4,
      }),
    ).not.toBe(
      correctionBenchmarkConfigurationSha256({
        configuration,
        supplierCostCapUsd: 3,
      }),
    );
  });

  it('binds the authorized candidate into the autonomous configuration digest', () => {
    const { configuration } = fullRunFixture();
    expect(
      correctionBenchmarkConfigurationSha256({
        candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
        configuration,
        supplierCostCapUsd: 4,
      }),
    ).not.toBe(
      correctionBenchmarkConfigurationSha256({
        candidateId: 'gemini-3-6-flash-openrouter-google-ai-studio',
        configuration,
        supplierCostCapUsd: 4,
      }),
    );
  });
});
