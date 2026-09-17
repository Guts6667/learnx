import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { applyResearchPriceCeilings } from '../../lib/ai-correction-research-guarded-fetch.js';
import {
  buildCheckerRequestBody,
  createRuntimeCorrectionChecker,
  DEFAULT_CHECKER_INSTRUCTIONS,
} from './correction-checker.js';
import { PROMOTED_CHECKER_IDENTITY } from './promoted-identity.js';
import { parseFalseAgreeProbe } from '../../lib/ai-correction-false-agree-probe.js';
import {
  designedCheckerIdentity,
  readDesignedProbeEvidence,
} from '../../lib/ai-correction-regression-probe-evidence.js';
import { runDesignedCheckerProbe } from '../../lib/ai-correction-regression-probe-cli.js';

it('binds the actual rendered research checker requests and schema, including temperature and price ceilings', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'checker-profile-'));
  try {
    const probePath = path.resolve(
      'benchmarks/ai-correction/regression/false-agree-probe.v1.json',
    );
    const probe = parseFalseAgreeProbe(
      JSON.parse(await readFile(probePath, 'utf8')) as unknown,
    );
    const model = {
      modelId: PROMOTED_CHECKER_IDENTITY.modelId,
      promptUsdPerToken: 0.0000015,
      completionUsdPerToken: 0.0000075,
      maxOutputTokens: 400,
    };
    const requests = probe.cases.map((entry) => ({
      id: entry.id,
      body: applyResearchPriceCeilings(buildCheckerRequestBody([entry]), model),
    }));
    const profile = {
      routeProviders: PROMOTED_CHECKER_IDENTITY.requestProfile.routeProviders,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      timeoutMs: PROMOTED_CHECKER_IDENTITY.requestProfile.timeoutMs,
      method: 'POST',
      redirect: 'error',
      requests,
    };
    const binding = {
      checker: designedCheckerIdentity({
        modelId: model.modelId,
        requestProfile: profile,
        instructions: DEFAULT_CHECKER_INSTRUCTIONS,
      }),
      qualificationRunId: 'offline-wire',
      measurementKind: 'SYNTHETIC' as const,
      simulatesValidatedFamily: false,
    };
    const actualRequests: string[] = [];
    const runtime = createRuntimeCorrectionChecker({
      apiKey: 'offline',
      appUrl: 'https://learnx.local',
      fetchImplementation: async (resource, init) => {
        const request = new Request(resource, init);
        const body = applyResearchPriceCeilings(
          JSON.parse(await request.text()) as unknown,
          model,
        );
        const serialized = JSON.stringify(body);
        actualRequests.push(serialized);
        expect(
          requests.some((entry) => JSON.stringify(entry.body) === serialized),
        ).toBe(true);
        expect(body.temperature).toBe(0);
        expect(body.reasoning).toBeUndefined();
        expect(body.provider.max_price).toEqual({
          prompt: 1.5,
          completion: 7.5,
        });
        const criterionKey = /key="([^"]+)"/.exec(
          body.messages[0]?.content ?? '',
        )?.[1];
        return new Response(
          JSON.stringify({
            model: model.modelId,
            provider: 'Mistral',
            usage: { cost: 0.000001 },
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: JSON.stringify({
                    verdicts: [{ criterionKey, supported: false }],
                  }),
                },
              },
            ],
          }),
        );
      },
    });
    const output = await runDesignedCheckerProbe({
      arguments: [
        '--execute',
        '--supplier-cost-cap-usd=1',
        '--envelope-usd=1',
        '--envelope-decision=offline-wire',
      ],
      binding,
      instructions: DEFAULT_CHECKER_INSTRUCTIONS,
      executableProfile: profile,
      checker: {
        verify: async ({ criteria }) => {
          const result = await runtime.verify({ questions: criteria });
          return { costUsd: result.costUsd, verdicts: result.verdicts };
        },
      },
      apiKey: 'offline',
      budgetDirectory: path.join(directory, 'budget'),
      probePath,
      outputDirectory: path.join(directory, 'result'),
      pricing: model,
      maxOutputTokens: 400,
      readProviderUsage: async () => 0,
    });
    expect(actualRequests).toHaveLength(20);
    if (!output.evidencePath) throw new Error('Missing evidence');
    expect(
      (
        await readDesignedProbeEvidence({
          evidencePath: output.evidencePath,
          probePath,
          binding,
        })
      ).result.checkerFalseAgreeDesigned,
    ).toEqual({ numerator: 0, denominator: 20, rate: 0 });
    expect(output.evidence?.executableProfile).toEqual(profile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
