import {
  createAccessInvitationEmailContent,
  createVerificationEmailContent,
  ResendEmailProvider,
} from './email-provider';

const input = {
  expiresAt: new Date('2026-08-06T10:00:00.000Z'),
  idempotencyKey: 'verification-1',
  locale: 'fr' as const,
  recipientEmail: 'learner@example.com',
  verificationUrl: 'https://learnx.example/verify-email#token=safe-token_value',
};

describe('email provider', () => {
  it('creates accessible text and HTML invitation content', () => {
    const invitation = {
      activationUrl: 'https://learn-x.app/activate#token=secret-token',
      expiresAt: input.expiresAt,
      locale: 'fr' as const,
      recipientEmail: input.recipientEmail,
    };
    const content = createAccessInvitationEmailContent(invitation);

    expect(content.subject).toBe('Active ton compte LearnX');
    expect(content.text).toContain(invitation.activationUrl);
    expect(content.html).toContain('Activer mon compte');
    expect(content.html).not.toContain('<script>');
  });

  it('creates accessible text and HTML verification content', () => {
    const content = createVerificationEmailContent(input);

    expect(content.subject).toBe('Vérifie ton adresse e-mail pour LearnX');
    expect(content.text).toContain(input.verificationUrl);
    expect(content.html).toContain('Vérifier mon adresse');
    expect(content.html).toContain(input.verificationUrl);
  });

  it('localizes verification and invitation emails in English', () => {
    const verification = createVerificationEmailContent({
      ...input,
      locale: 'en',
    });
    const invitation = createAccessInvitationEmailContent({
      activationUrl: 'https://learn-x.app/activate#token=safe-token',
      expiresAt: input.expiresAt,
      locale: 'en',
      recipientEmail: input.recipientEmail,
    });

    expect(verification.subject).toBe('Verify your email address for LearnX');
    expect(verification.html).toContain('Verify my address');
    expect(invitation.subject).toBe('Activate your LearnX account');
    expect(invitation.html).toContain('Activate my account');
  });

  it('sends through Resend with an idempotency key', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    const provider = new ResendEmailProvider({
      apiKey: 'secret-api-key',
      fetch: fetchMock,
      from: 'LearnX <access@learnx.example>',
    });

    await provider.sendVerificationEmail(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer secret-api-key',
          'idempotency-key': 'verification-1',
        }),
        method: 'POST',
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual(
      expect.objectContaining({
        from: 'LearnX <access@learnx.example>',
        to: ['learner@example.com'],
      }),
    );
  });

  it('sends an access invitation through the same provider adapter', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    const provider = new ResendEmailProvider({
      apiKey: 'secret-api-key',
      fetch: fetchMock,
      from: 'LearnX <access@learnx.example>',
    });

    await provider.sendAccessInvitationEmail({
      activationUrl: 'https://learn-x.app/activate#token=safe-token',
      expiresAt: input.expiresAt,
      idempotencyKey: 'invitation-1',
      locale: 'fr',
      recipientEmail: input.recipientEmail,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({
          'idempotency-key': 'invitation-1',
        }),
      }),
    );
  });

  it('does not expose the provider response when delivery fails', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response('provider payload containing sensitive content', {
          status: 422,
        }),
      ),
    );
    const provider = new ResendEmailProvider({
      apiKey: 'secret-api-key',
      fetch: fetchMock,
      from: 'LearnX <access@learnx.example>',
    });

    await expect(provider.sendVerificationEmail(input)).rejects.toThrow(
      'Email provider rejected the request (422).',
    );
  });
});
