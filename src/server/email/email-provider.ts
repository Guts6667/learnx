interface VerificationEmailContent {
  expiresAt: Date;
  recipientEmail: string;
  verificationUrl: string;
}

export interface VerificationEmailInput extends VerificationEmailContent {
  idempotencyKey: string;
}

export interface EmailProvider {
  readonly name: string;
  sendVerificationEmail(input: VerificationEmailInput): Promise<void>;
}

interface ResendEmailProviderOptions {
  apiKey: string;
  fetch?: typeof fetch;
  from: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createVerificationEmailContent({
  expiresAt,
  recipientEmail,
  verificationUrl,
}: VerificationEmailContent) {
  const expiration = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(expiresAt);
  const safeUrl = escapeHtml(verificationUrl);

  return {
    html: [
      '<h1>Vérifie ton adresse e-mail</h1>',
      '<p>Confirme ton adresse pour transmettre ta demande d’accès à l’administrateur LearnX.</p>',
      `<p><a href="${safeUrl}">Vérifier mon adresse</a></p>`,
      `<p>Ce lien expire le ${escapeHtml(expiration)} et ne peut être utilisé qu’une fois.</p>`,
      '<p>Si tu n’as pas demandé cet accès, ignore cet e-mail.</p>',
    ].join(''),
    subject: 'Vérifie ton adresse e-mail pour LearnX',
    text: [
      'Vérifie ton adresse e-mail',
      '',
      'Confirme ton adresse pour transmettre ta demande d’accès à l’administrateur LearnX.',
      verificationUrl,
      '',
      `Ce lien expire le ${expiration} et ne peut être utilisé qu’une fois.`,
      'Si tu n’as pas demandé cet accès, ignore cet e-mail.',
    ].join('\n'),
    to: recipientEmail,
  };
}

export class ResendEmailProvider implements EmailProvider {
  public readonly name = 'resend';

  private readonly fetchImplementation: typeof fetch;

  public constructor(private readonly options: ResendEmailProviderOptions) {
    this.fetchImplementation = options.fetch ?? fetch;
  }

  public async sendVerificationEmail(
    input: VerificationEmailInput,
  ): Promise<void> {
    const content = createVerificationEmailContent(input);
    const response = await this.fetchImplementation(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': input.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.options.from,
          html: content.html,
          subject: content.subject,
          text: content.text,
          to: [content.to],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Email provider rejected the request (${response.status}).`,
      );
    }
  }
}
