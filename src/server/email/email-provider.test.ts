import {
  createVerificationEmailContent,
  ResendEmailProvider,
} from './email-provider';

const input = {
  expiresAt: new Date('2026-08-06T10:00:00.000Z'),
  idempotencyKey: 'verification-1',
  recipientEmail: 'learner@example.com',
  verificationUrl: 'https://learnx.example/verify-email#token=safe-token_value',
};

describe('email provider', () => {
  it('creates accessible text and HTML verification content', () => {
    const content = createVerificationEmailContent(input);

    expect(content.subject).toBe('Vérifie ton adresse e-mail pour LearnX');
    expect(content.text).toContain(input.verificationUrl);
    expect(content.html).toContain('Vérifier mon adresse');
    expect(content.html).toContain(input.verificationUrl);
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
