import { publicLeadConsentVersion } from './configuration.js';
import {
  buildPublicLeadActionUrl,
  hashPublicLeadToken,
} from './token-service.js';
import type {
  PublicLeadRequest,
  PublicLeadServiceDependencies,
} from './types.js';

export async function requestPublicLead(
  input: PublicLeadRequest,
  dependencies: PublicLeadServiceDependencies,
): Promise<void> {
  const confirmationToken = dependencies.createToken();
  const managementToken = dependencies.createToken();
  const now = dependencies.now();
  const idempotencyKey = await dependencies.repository.issue({
    confirmationExpiresAt: new Date(
      now.getTime() + dependencies.ttlMilliseconds,
    ),
    confirmationTokenHash: hashPublicLeadToken(confirmationToken),
    consentVersion: publicLeadConsentVersion,
    email: input.email,
    id: dependencies.createId(),
    locale: input.locale,
    managementTokenHash: hashPublicLeadToken(managementToken),
    motivation: input.motivation,
    now,
    purpose: input.purpose,
  });
  try {
    await dependencies.emailProvider.send({
      confirmationUrl: buildPublicLeadActionUrl(
        dependencies.appUrl,
        'confirm',
        confirmationToken,
      ),
      deletionUrl: buildPublicLeadActionUrl(
        dependencies.appUrl,
        'delete',
        managementToken,
      ),
      email: input.email,
      idempotencyKey,
      locale: input.locale,
      purpose: input.purpose,
      unsubscribeUrl: buildPublicLeadActionUrl(
        dependencies.appUrl,
        'unsubscribe',
        managementToken,
      ),
    });
  } catch {
    console.error('Public lead confirmation delivery failed.', {
      leadId: idempotencyKey,
    });
  }
}

export { createPublicLeadServiceDependencies } from './configuration.js';
export { prismaPublicLeadRepository } from './repository.js';
export type {
  PublicLeadRepository,
  PublicLeadServiceDependencies,
} from './types.js';
