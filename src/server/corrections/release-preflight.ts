import type { OpenRouterConfiguration } from '../ai/openrouter-configuration.js';

import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';

export const CORRECTION_RELEASE_PREFLIGHT_STATES = [
  'DISABLED',
  'CONFIGURATION_BLOCKED',
  'CONFIGURED_CLOSED',
  'READY',
] as const;

export type CorrectionReleasePreflightState =
  (typeof CORRECTION_RELEASE_PREFLIGHT_STATES)[number];

export interface CorrectionReleasePreflight {
  apiKeyPresent: boolean;
  deploymentEnvironment: OpenRouterConfiguration['deploymentEnvironment'];
  identityMatches: boolean;
  killSwitch: boolean;
  promotedBenchmarkId: string;
  state: CorrectionReleasePreflightState;
}

function assignmentMatchesPromotedIdentity(
  configuration: OpenRouterConfiguration,
  role: 'CORRECTION_PRIMARY' | 'CORRECTION_SECOND_PASS',
): boolean {
  const assignment = configuration.assignments[role];
  return (
    assignment?.modelId === PROMOTED_CORRECTION_IDENTITY.modelId &&
    assignment.provider === PROMOTED_CORRECTION_IDENTITY.provider
  );
}

export function evaluateCorrectionReleasePreflight(
  configuration: OpenRouterConfiguration,
): CorrectionReleasePreflight {
  const apiKeyPresent = Boolean(configuration.apiKey);
  const identityMatches =
    assignmentMatchesPromotedIdentity(configuration, 'CORRECTION_PRIMARY') &&
    assignmentMatchesPromotedIdentity(configuration, 'CORRECTION_SECOND_PASS');

  let state: CorrectionReleasePreflightState;
  if (!configuration.enabled) {
    state = 'DISABLED';
  } else if (!apiKeyPresent || !identityMatches) {
    state = 'CONFIGURATION_BLOCKED';
  } else if (configuration.killSwitch) {
    state = 'CONFIGURED_CLOSED';
  } else {
    state = 'READY';
  }

  return {
    apiKeyPresent,
    deploymentEnvironment: configuration.deploymentEnvironment,
    identityMatches,
    killSwitch: configuration.killSwitch,
    promotedBenchmarkId: PROMOTED_CORRECTION_IDENTITY.benchmarkId,
    state,
  };
}
