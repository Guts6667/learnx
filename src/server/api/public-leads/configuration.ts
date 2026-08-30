import { randomBytes, randomUUID } from 'node:crypto';

import { createResendPublicLeadEmailProvider } from './email-provider.js';
import { prismaPublicLeadRepository } from './repository.js';
import type { PublicLeadServiceDependencies } from './types.js';

export const publicLeadConsentVersion = 'landing-v1';

export function createPublicLeadServiceDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): PublicLeadServiceDependencies | undefined {
  // Closed unless explicitly opened (V4.5-178). The previous reading refused
  // only the exact string `false`, so an absent variable — and `FALSE`, `0`,
  // `no`, or a value with a stray space — all meant *enabled*. The variable was
  // set in neither Vercel environment while `RESEND_API_KEY`, `APP_URL` and
  // `LEARNX_EMAIL_FROM` all were, so collection of e-mail addresses from the
  // public landing page was live because nobody had turned it off.
  //
  // `=== 'true'` is the same reading `LEARNX_PAYMENTS_ENABLED` already uses: a
  // feature that touches strangers' personal data is opened by a decision, not
  // by the absence of one.
  if (environment.LEARNX_PUBLIC_LEADS_ENABLED !== 'true') return undefined;
  const apiKey = environment.RESEND_API_KEY;
  const appUrl = environment.APP_URL;
  const from = environment.LEARNX_EMAIL_FROM;
  if (!apiKey || !appUrl || !from) return undefined;
  return {
    appUrl: new URL(appUrl).origin,
    createId: randomUUID,
    createToken: () => randomBytes(32).toString('base64url'),
    emailProvider: createResendPublicLeadEmailProvider({ apiKey, from }),
    now: () => new Date(),
    repository: prismaPublicLeadRepository,
    ttlMilliseconds: 24 * 60 * 60 * 1_000,
  };
}
