import { randomBytes, randomUUID } from 'node:crypto';

import { createResendPublicLeadEmailProvider } from './email-provider.js';
import { prismaPublicLeadRepository } from './repository.js';
import type { PublicLeadServiceDependencies } from './types.js';

export const publicLeadConsentVersion = 'landing-v1';

export function createPublicLeadServiceDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): PublicLeadServiceDependencies | undefined {
  if (environment.LEARNX_PUBLIC_LEADS_ENABLED === 'false') return undefined;
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
