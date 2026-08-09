import type { SupportedLocale } from '../../shared/locale.js';
import { formatLocalizedDate } from '../../shared/locale.js';

interface VerificationEmailContent {
  expiresAt: Date;
  recipientEmail: string;
  locale: SupportedLocale;
  verificationUrl: string;
}

interface AccessInvitationEmailContent {
  activationUrl: string;
  expiresAt: Date;
  recipientEmail: string;
  locale: SupportedLocale;
}

export interface VerificationEmailInput extends VerificationEmailContent {
  idempotencyKey: string;
}

export interface AccessInvitationEmailInput
  extends AccessInvitationEmailContent {
  idempotencyKey: string;
}

export interface EmailProvider {
  readonly name: string;
  sendVerificationEmail(input: VerificationEmailInput): Promise<void>;
}

export interface AccessInvitationEmailProvider {
  readonly name: string;
  sendAccessInvitationEmail(input: AccessInvitationEmailInput): Promise<void>;
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
  locale,
  verificationUrl,
}: VerificationEmailContent) {
  const expiration = formatLocalizedDate(expiresAt, locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
  const safeUrl = escapeHtml(verificationUrl);

  if (locale === 'en') {
    return {
      html: [
        '<h1>Verify your email address</h1>',
        '<p>Confirm your address to send your access request to the LearnX administrator.</p>',
        `<p><a href="${safeUrl}">Verify my address</a></p>`,
        `<p>This link expires on ${escapeHtml(expiration)} and can only be used once.</p>`,
        '<p>If you did not request access, you can ignore this email.</p>',
      ].join(''),
      subject: 'Verify your email address for LearnX',
      text: [
        'Verify your email address',
        '',
        'Confirm your address to send your access request to the LearnX administrator.',
        verificationUrl,
        '',
        `This link expires on ${expiration} and can only be used once.`,
        'If you did not request access, you can ignore this email.',
      ].join('\n'),
      to: recipientEmail,
    };
  }

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

export function createAccessInvitationEmailContent({
  activationUrl,
  expiresAt,
  recipientEmail,
  locale,
}: AccessInvitationEmailContent) {
  const expiration = formatLocalizedDate(expiresAt, locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
  const safeUrl = escapeHtml(activationUrl);

  if (locale === 'en') {
    return {
      html: [
        '<h1>Your LearnX access has been approved</h1>',
        '<p>Choose your password now to activate your account.</p>',
        `<p><a href="${safeUrl}">Activate my account</a></p>`,
        `<p>This link expires on ${escapeHtml(expiration)} and can only be used once.</p>`,
        '<p>If you were not expecting this invitation, you can ignore this email.</p>',
      ].join(''),
      subject: 'Activate your LearnX account',
      text: [
        'Your LearnX access has been approved',
        '',
        'Choose your password now to activate your account.',
        activationUrl,
        '',
        `This link expires on ${expiration} and can only be used once.`,
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n'),
      to: recipientEmail,
    };
  }

  return {
    html: [
      '<h1>Ton accès à LearnX est accepté</h1>',
      '<p>Choisis maintenant ton mot de passe pour activer ton compte.</p>',
      `<p><a href="${safeUrl}">Activer mon compte</a></p>`,
      `<p>Ce lien expire le ${escapeHtml(expiration)} et ne peut être utilisé qu’une fois.</p>`,
      '<p>Si tu n’attendais pas cette invitation, ignore cet e-mail.</p>',
    ].join(''),
    subject: 'Active ton compte LearnX',
    text: [
      'Ton accès à LearnX est accepté',
      '',
      'Choisis maintenant ton mot de passe pour activer ton compte.',
      activationUrl,
      '',
      `Ce lien expire le ${expiration} et ne peut être utilisé qu’une fois.`,
      'Si tu n’attendais pas cette invitation, ignore cet e-mail.',
    ].join('\n'),
    to: recipientEmail,
  };
}

export class ResendEmailProvider
  implements EmailProvider, AccessInvitationEmailProvider
{
  public readonly name = 'resend';

  private readonly fetchImplementation: typeof fetch;

  public constructor(private readonly options: ResendEmailProviderOptions) {
    this.fetchImplementation = options.fetch ?? fetch;
  }

  public async sendVerificationEmail(
    input: VerificationEmailInput,
  ): Promise<void> {
    await this.sendEmail(
      createVerificationEmailContent(input),
      input.idempotencyKey,
    );
  }

  public async sendAccessInvitationEmail(
    input: AccessInvitationEmailInput,
  ): Promise<void> {
    await this.sendEmail(
      createAccessInvitationEmailContent(input),
      input.idempotencyKey,
    );
  }

  private async sendEmail(
    content: { html: string; subject: string; text: string; to: string },
    idempotencyKey: string,
  ): Promise<void> {
    const response = await this.fetchImplementation(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
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
