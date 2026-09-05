import { publicLeadConsentVersion } from './configuration.js';
import {
  buildPublicLeadActionUrl,
  hashPublicLeadToken,
} from './token-service.js';
import type {
  PublicLeadRequest,
  PublicLeadServiceDependencies,
} from './types.js';

/**
 * Enregistre une soumission du formulaire d'accès anticipé (V4.5-228).
 *
 * Une soumission peut porter DEUX motifs : la candidature, et l'abonnement aux
 * nouvelles si la case est cochée. Ils vivent dans deux lignes — la contrainte
 * d'unicité est `(contact, motif)` — mais ils viennent d'un seul geste, et
 * c'est ce geste que l'apprenant confirme.
 *
 * Un seul courriel part donc, celui du motif principal. En envoyer deux pour
 * un formulaire soumis une fois donnerait à lire deux inscriptions là où il
 * n'y en a eu qu'une, et deux liens de confirmation dont l'un semblerait de
 * trop.
 *
 * L'abonnement est écrit AVANT le courriel et son échec n'interrompt rien :
 * il est accessoire à la candidature, et perdre la candidature parce que
 * l'abonnement a échoué inverserait l'importance des deux.
 */
export async function requestPublicLead(
  input: PublicLeadRequest,
  dependencies: PublicLeadServiceDependencies,
): Promise<void> {
  const confirmationToken = dependencies.createToken();
  const managementToken = dependencies.createToken();
  const now = dependencies.now();
  const confirmationExpiresAt = new Date(
    now.getTime() + dependencies.ttlMilliseconds,
  );
  const idempotencyKey = await dependencies.repository.issue({
    confirmationExpiresAt,
    confirmationTokenHash: hashPublicLeadToken(confirmationToken),
    consentVersion: publicLeadConsentVersion,
    email: input.email,
    firstName: input.firstName,
    friction: input.friction,
    id: dependencies.createId(),
    locale: input.locale,
    managementTokenHash: hashPublicLeadToken(managementToken),
    motivation: input.motivation,
    now,
    purpose: input.purpose,
  });

  // La case cochée abonne en plus. Ses propres jetons : chaque ligne garde son
  // lien de désabonnement, sinon se retirer des nouvelles retirerait aussi la
  // candidature.
  const alsoSubscribes =
    input.launchUpdates === true && input.purpose === 'EARLY_ADOPTER';
  if (alsoSubscribes) {
    try {
      await dependencies.repository.issue({
        confirmationExpiresAt,
        confirmationTokenHash: hashPublicLeadToken(dependencies.createToken()),
        consentVersion: publicLeadConsentVersion,
        email: input.email,
        firstName: input.firstName,
        id: dependencies.createId(),
        locale: input.locale,
        managementTokenHash: hashPublicLeadToken(dependencies.createToken()),
        now,
        purpose: 'LAUNCH_UPDATES',
      });
    } catch {
      console.error('Public lead launch-updates subscription failed.', {
        leadId: idempotencyKey,
      });
    }
  }

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
      firstName: input.firstName,
      idempotencyKey,
      includesLaunchUpdates: alsoSubscribes,
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
