import type { OpenRouterConfiguration } from '../ai/openrouter-configuration.js';

import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from './promoted-identity.js';

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
  /**
   * PROMOTED  — assigned and matching the pin.
   * UNASSIGNED — no checker configured; verdicts degrade to UNAVAILABLE.
   * MISMATCHED — a checker is configured but it is not the promoted model.
   *
   * The two failure states are reported apart on purpose: unassigned is an
   * environment that has not been finished, mismatched is one that has been
   * finished wrong, and they call for opposite reactions.
   */
  checker: 'PROMOTED' | 'UNASSIGNED' | 'MISMATCHED';
  checkerPromotedModelId: string;
  /**
   * False until V4.5-121 measures the checker. The pin is attested, meaning
   * only one named model may hold the role; it is not yet measured, meaning we
   * do not know how well it holds it. Reporting the two separately is the whole
   * point: READY says the configuration is right, never that the model is good.
   */
  checkerScientificallyMeasured: boolean;
  deploymentEnvironment: OpenRouterConfiguration['deploymentEnvironment'];
  identityMatches: boolean;
  killSwitch: boolean;
  promotedBenchmarkId: string;
  state: CorrectionReleasePreflightState;
  /** FAKE means verdicts are fabricated locally; never a production READY. */
  transport: 'REAL' | 'FAKE';
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

function checkerAttestation(
  configuration: OpenRouterConfiguration,
): CorrectionReleasePreflight['checker'] {
  const assignment = configuration.assignments.CORRECTION_CHECKER;
  if (!assignment) return 'UNASSIGNED';
  return assignment.modelId === PROMOTED_CHECKER_IDENTITY.modelId &&
    assignment.provider === PROMOTED_CHECKER_IDENTITY.provider
    ? 'PROMOTED'
    : 'MISMATCHED';
}

export function evaluateCorrectionReleasePreflight(
  configuration: OpenRouterConfiguration,
  options: { transport?: 'REAL' | 'FAKE' } = {},
): CorrectionReleasePreflight {
  const apiKeyPresent = Boolean(configuration.apiKey);
  const identityMatches =
    assignmentMatchesPromotedIdentity(configuration, 'CORRECTION_PRIMARY') &&
    assignmentMatchesPromotedIdentity(configuration, 'CORRECTION_SECOND_PASS');
  const checker = checkerAttestation(configuration);
  const transport = options.transport ?? 'REAL';

  // An environment without the checker is not broken, only incomplete: the
  // checker returns UNAVAILABLE and corrections stay capped at MEDIUM. It is
  // still not READY, because READY is what authorises HIGH.
  let state: CorrectionReleasePreflightState;
  if (!configuration.enabled) {
    state = 'DISABLED';
  } else if (!apiKeyPresent || !identityMatches || checker !== 'PROMOTED') {
    state = 'CONFIGURATION_BLOCKED';
  } else if (configuration.killSwitch) {
    state = 'CONFIGURED_CLOSED';
  } else {
    state = 'READY';
  }

  return {
    apiKeyPresent,
    checker,
    checkerPromotedModelId: PROMOTED_CHECKER_IDENTITY.modelId,
    checkerScientificallyMeasured:
      PROMOTED_CHECKER_IDENTITY.promotion.scientific,
    deploymentEnvironment: configuration.deploymentEnvironment,
    identityMatches,
    killSwitch: configuration.killSwitch,
    promotedBenchmarkId: PROMOTED_CORRECTION_IDENTITY.benchmarkId,
    state,
    transport,
  };
}
