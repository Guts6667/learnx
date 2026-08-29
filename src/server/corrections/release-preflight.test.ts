import { describe, expect, it } from 'vitest';

import type { OpenRouterConfiguration } from '../ai/openrouter-configuration';

import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from './promoted-identity';
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
      CORRECTION_CHECKER: {
        modelId: PROMOTED_CHECKER_IDENTITY.modelId,
        provider: PROMOTED_CHECKER_IDENTITY.provider,
      },
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

  it('bloque un environnement sans vérificateur sans le faire tomber', () => {
    // The checker is what authorises HIGH, so its absence cannot be READY.
    // It is not CONFIGURATION_INVALID either: the configuration parses, the
    // correction path runs, and verdicts resolve to UNAVAILABLE. That is what
    // lets the code deploy before the environment variables.
    const withoutChecker = configuration().assignments;
    delete withoutChecker.CORRECTION_CHECKER;
    const preflight = evaluateCorrectionReleasePreflight(
      configuration({ assignments: withoutChecker, killSwitch: false }),
    );
    expect(preflight).toMatchObject({
      checkerIdentityMatches: false,
      identityMatches: true,
      state: 'CONFIGURATION_BLOCKED',
    });
  });

  it('refuse un vérificateur qui n’est pas le modèle promu', () => {
    expect(
      evaluateCorrectionReleasePreflight(
        configuration({
          assignments: {
            ...configuration().assignments,
            CORRECTION_CHECKER: {
              modelId: 'vendor/unpromoted-checker',
              provider: 'vendor',
            },
          },
          killSwitch: false,
        }),
      ),
    ).toMatchObject({
      checkerIdentityMatches: false,
      state: 'CONFIGURATION_BLOCKED',
    });
  });

  it('annonce que le vérificateur est épinglé mais pas encore mesuré', () => {
    // Attested is not measured. V4.5-121 flips this, and nothing else should.
    expect(evaluateCorrectionReleasePreflight(configuration())).toMatchObject({
      checkerPromotedModelId: PROMOTED_CHECKER_IDENTITY.modelId,
      checkerScientificallyMeasured: false,
    });
  });

  it('signale un transport factice pour qu’aucun READY ne passe pour réel', () => {
    expect(
      evaluateCorrectionReleasePreflight(configuration({ killSwitch: false }), {
        transport: 'FAKE',
      }),
    ).toMatchObject({ state: 'READY', transport: 'FAKE' });
  });

  it('keeps the globally disabled state explicit', () => {
    expect(
      evaluateCorrectionReleasePreflight(
        configuration({ assignments: {}, enabled: false }),
      ),
    ).toMatchObject({ identityMatches: false, state: 'DISABLED' });
  });
});
