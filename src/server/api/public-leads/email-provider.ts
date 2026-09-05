import type { PublicLeadEmailInput, PublicLeadEmailProvider } from './types.js';

/**
 * Le prénom est du texte que la personne a écrit, et il part dans du HTML
 * (V4.5-228). Un prénom contenant `<` ou `&` casserait le courriel au mieux,
 * y injecterait du balisage au pire. Échappé à l'insertion, pas à la
 * validation : la base garde ce qui a été saisi, c'est le rendu qui protège.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailCopy(input: PublicLeadEmailInput) {
  const early = input.purpose === 'EARLY_ADOPTER';
  const english = input.locale === 'en';
  return {
    confirmLabel: english ? 'Confirm my request' : 'Confirmer ma demande',
    deleteLabel: english ? 'Delete my data' : 'Supprimer mes données',
    // Salutation par le prénom quand il a été donné (V4.5-228).
    greeting: input.firstName
      ? english
        ? `Hi ${input.firstName},`
        : `Bonjour ${input.firstName},`
      : null,
    heading: english
      ? 'Confirm your email address'
      : 'Confirme ton adresse e-mail',
    // Dit dans le même courriel que la case a bien abonné : une soumission,
    // un courriel, et rien que la personne aurait à déduire.
    launchUpdatesNote:
      input.includesLaunchUpdates === true
        ? english
          ? 'You also asked for launch updates; this same link confirms both.'
          : 'Tu as aussi demandé les nouvelles du lancement : ce même lien confirme les deux.'
        : null,
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
  const greetingHtml = copy.greeting
    ? `<p>${escapeHtml(copy.greeting)}</p>`
    : '';
  const noteHtml = copy.launchUpdatesNote
    ? `<p>${copy.launchUpdatesNote}</p>`
    : '';
  const greetingText = copy.greeting ? `${copy.greeting}\n\n` : '';
  const noteText = copy.launchUpdatesNote
    ? `\n\n${copy.launchUpdatesNote}`
    : '';
  return {
    html: `<h1>${copy.heading}</h1>${greetingHtml}<p><a href="${input.confirmationUrl}">${copy.confirmLabel}</a></p>${noteHtml}<p><a href="${input.unsubscribeUrl}">${copy.unsubscribeLabel}</a> · <a href="${input.deletionUrl}">${copy.deleteLabel}</a></p>`,
    subject: copy.subject,
    text: `${copy.heading}\n\n${greetingText}${input.confirmationUrl}${noteText}\n\n${copy.unsubscribeLabel}: ${input.unsubscribeUrl}\n${copy.deleteLabel}: ${input.deletionUrl}`,
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
