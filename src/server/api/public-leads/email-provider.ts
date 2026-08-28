import type { PublicLeadEmailInput, PublicLeadEmailProvider } from './types.js';

function getEmailCopy(input: PublicLeadEmailInput) {
  const early = input.purpose === 'EARLY_ADOPTER';
  const english = input.locale === 'en';
  return {
    confirmLabel: english ? 'Confirm my request' : 'Confirmer ma demande',
    deleteLabel: english ? 'Delete my data' : 'Supprimer mes données',
    heading: english
      ? 'Confirm your email address'
      : 'Confirme ton adresse e-mail',
    subject: english
      ? early
        ? 'Confirm your LearnX early-adopter application'
        : 'Confirm your LearnX launch updates'
      : early
        ? 'Confirme ta candidature early adopter LearnX'
        : 'Confirme ton suivi du lancement LearnX',
    unsubscribeLabel: english ? 'Unsubscribe' : 'Se désinscrire',
  };
}

function buildEmailBody(input: PublicLeadEmailInput) {
  const copy = getEmailCopy(input);
  return {
    html: `<h1>${copy.heading}</h1><p><a href="${input.confirmationUrl}">${copy.confirmLabel}</a></p><p><a href="${input.unsubscribeUrl}">${copy.unsubscribeLabel}</a> · <a href="${input.deletionUrl}">${copy.deleteLabel}</a></p>`,
    subject: copy.subject,
    text: `${copy.heading}\n\n${input.confirmationUrl}\n\n${copy.unsubscribeLabel}: ${input.unsubscribeUrl}\n${copy.deleteLabel}: ${input.deletionUrl}`,
  };
}

export function createResendPublicLeadEmailProvider(input: {
  apiKey: string;
  from: string;
}): PublicLeadEmailProvider {
  return {
    async send(emailInput) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `public-lead-${emailInput.idempotencyKey}`,
        },
        body: JSON.stringify({
          ...buildEmailBody(emailInput),
          from: input.from,
          to: [emailInput.email],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Email provider rejected the request (${response.status}).`,
        );
      }
    },
  };
}
