import { describe, expect, it } from 'vitest';

import type { OpenRouterConfiguration } from '../ai/openrouter-configuration';

import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';
import { evaluateCorrectionReleasePreflight } from './release-preflight';

function configuration(
  overrides: Partial<OpenRouterConfiguration> = {},
): OpenRouterConfiguration {
  const promotedAssignment = {
    modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
    provider: PROMOTED_CORRECTION_IDENTITY.provider,
  };
  return {
    apiKey: 'server-secret',
    appUrl: 'https://preview.learn-x.app',
    assignments: {
      CORRECTION_PRIMARY: promotedAssignment,
      CORRECTION_SECOND_PASS: promotedAssignment,
    },
    deploymentEnvironment: 'preview',
    enabled: true,
    killSwitch: true,
    maxContextCharacters: 120_000,
    maxOutputTokens: 4_096,
    maxRetryDelayMs: 2_000,
    requestTimeoutMs: 30_000,
    ...overrides,
  };
}

describe('correction release preflight', () => {
  it('distinguishes a configured closed preview from an open runtime', () => {
    expect(evaluateCorrectionReleasePreflight(configuration())).toMatchObject({
      apiKeyPresent: true,
      identityMatches: true,
      killSwitch: true,
      state: 'CONFIGURED_CLOSED',
    });
    expect(
      evaluateCorrectionReleasePreflight(configuration({ killSwitch: false })),
    ).toMatchObject({ killSwitch: false, state: 'READY' });
  });

  it('blocks missing secrets and any identity drift without exposing a key', () => {
    expect(
      evaluateCorrectionReleasePreflight(configuration({ apiKey: null })),
    ).toMatchObject({
      apiKeyPresent: false,
      identityMatches: true,
      state: 'CONFIGURATION_BLOCKED',
    });
    expect(
      evaluateCorrectionReleasePreflight(
        configuration({
          assignments: {
            CORRECTION_PRIMARY: {
              modelId: 'vendor/unpromoted-model',
              provider: 'vendor',
            },
          },
        }),
      ),
    ).toMatchObject({
      apiKeyPresent: true,
      identityMatches: false,
      state: 'CONFIGURATION_BLOCKED',
    });
  });

  it('keeps the globally disabled state explicit', () => {
    expect(
      evaluateCorrectionReleasePreflight(
        configuration({ assignments: {}, enabled: false }),
      ),
    ).toMatchObject({ identityMatches: false, state: 'DISABLED' });
  });
});
