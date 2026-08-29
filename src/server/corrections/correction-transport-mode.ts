import { AiProviderError } from '../ai/structured-provider.js';

export type CorrectionTransportMode = 'REAL' | 'FAKE';

type EnvironmentValues = Record<string, string | undefined>;

/**
 * Resolves whether the correction path talks to a provider or fabricates its
 * answers, refusing the fake at construction time rather than at call time.
 *
 * A call-time check would let a misconfigured deployment boot, report itself
 * healthy and serve fabricated corrections to learners until someone noticed.
 * Refusing here means the process dies at startup instead, which is loud,
 * immediate and impossible to mistake for working.
 *
 * Both environment pins are consulted. `NODE_ENV` alone is not enough: a
 * preview build carrying the production AI configuration is production as far
 * as the provider, the credits and the learner data are concerned, and that is
 * exactly the deployment where a fake would do the most damage.
 */
export function resolveCorrectionTransportMode(
  values: EnvironmentValues = process.env,
): CorrectionTransportMode {
  if (values.LEARNX_AI_TRANSPORT?.trim() !== 'fake') return 'REAL';
  if (
    values.LEARNX_AI_CONFIG_ENVIRONMENT?.trim() === 'production' ||
    values.NODE_ENV?.trim() === 'production'
  ) {
    throw new AiProviderError('CONFIGURATION_INVALID', false);
  }
  return 'FAKE';
}
