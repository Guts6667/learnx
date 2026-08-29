import { AiProviderError } from '../ai/structured-provider.js';
import { createRuntimeCorrectionTransport } from './correction-orchestration.js';
import type { CorrectionTransportPort } from './correction-orchestration-contracts.js';
import { createFakeCorrectionTransport } from './fake-correction-transport.js';

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

export interface CorrectionTransportSelection {
  mode: CorrectionTransportMode;
  transport: CorrectionTransportPort;
}

/**
 * Resolves the mode and builds the matching transport in one step.
 *
 * The mode and the transport must come from the same decision. V4.5-111 shipped
 * them as two independent calls — the preflight resolved the mode while the
 * composition root always built the real transport — so the preflight could
 * report FAKE while real requests went to the provider and spent real money.
 * Returning both together makes that disagreement unrepresentable.
 */
export function selectCorrectionTransport(
  values: EnvironmentValues = process.env,
): CorrectionTransportSelection {
  const mode = resolveCorrectionTransportMode(values);
  return {
    mode,
    transport:
      mode === 'FAKE'
        ? createFakeCorrectionTransport()
        : createRuntimeCorrectionTransport(),
  };
}
