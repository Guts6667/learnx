import {
  AI_DEPLOYMENT_ENVIRONMENTS,
  readOpenRouterConfiguration,
  type AiDeploymentEnvironment,
} from '../src/server/ai/openrouter-configuration.js';
import {
  CORRECTION_RELEASE_PREFLIGHT_STATES,
  evaluateCorrectionReleasePreflight,
  type CorrectionReleasePreflightState,
} from '../src/server/corrections/release-preflight.js';

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function deploymentEnvironment(): AiDeploymentEnvironment {
  const value = option('environment');
  if (
    !value ||
    !AI_DEPLOYMENT_ENVIRONMENTS.includes(value as AiDeploymentEnvironment)
  ) {
    throw new Error('Use --environment=development|preview|production.');
  }
  return value as AiDeploymentEnvironment;
}

function expectedState(): CorrectionReleasePreflightState | undefined {
  const value = option('expect');
  if (!value) return undefined;
  if (
    !CORRECTION_RELEASE_PREFLIGHT_STATES.includes(
      value as CorrectionReleasePreflightState,
    )
  ) {
    throw new Error(
      `Use --expect=${CORRECTION_RELEASE_PREFLIGHT_STATES.join('|')}.`,
    );
  }
  return value as CorrectionReleasePreflightState;
}

const environment = deploymentEnvironment();
const expected = expectedState();
const result = evaluateCorrectionReleasePreflight(
  readOpenRouterConfiguration({ deploymentEnvironment: environment }),
);

console.log(JSON.stringify(result, null, 2));

if (result.state === 'CONFIGURATION_BLOCKED') {
  throw new Error('The AI correction release configuration is blocked.');
}
if (expected && result.state !== expected) {
  throw new Error(`Expected ${expected}, received ${result.state}.`);
}
