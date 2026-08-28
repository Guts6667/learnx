import { createResendPublicLeadEmailProvider } from './email-provider.js';
import type { PublicLeadEmailInput } from './types.js';

const originalFetch = globalThis.fetch;

function emailInput(
  locale: 'en' | 'fr',
  purpose: 'EARLY_ADOPTER' | 'LAUNCH_UPDATES',
): PublicLeadEmailInput {
  return {
    confirmationUrl: 'https://learn-x.app/confirm',
    deletionUrl: 'https://learn-x.app/delete',
    email: 'reader@example.com',
    idempotencyKey: `${locale}-${purpose}`,
    locale,
    purpose,
    unsubscribeUrl: 'https://learn-x.app/unsubscribe',
  };
}

describe('Resend public lead email provider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each([
    {
      locale: 'en' as const,
      purpose: 'EARLY_ADOPTER' as const,
      subject: 'Confirm your LearnX early-adopter application',
    },
    {
      locale: 'en' as const,
      purpose: 'LAUNCH_UPDATES' as const,
      subject: 'Confirm your LearnX launch updates',
    },
    {
      locale: 'fr' as const,
      purpose: 'EARLY_ADOPTER' as const,
      subject: 'Confirme ta candidature early adopter LearnX',
    },
    {
      locale: 'fr' as const,
      purpose: 'LAUNCH_UPDATES' as const,
      subject: 'Confirme ton suivi du lancement LearnX',
    },
  ])('renders $locale $purpose transactional copy', async ({
    locale,
    purpose,
    subject,
  }) => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    );
    globalThis.fetch = fetchMock;
    const provider = createResendPublicLeadEmailProvider({
      apiKey: 'resend-key',
      from: 'LearnX <hello@learn-x.app>',
    });

    await provider.send(emailInput(locale, purpose));

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      html: string;
      subject: string;
      text: string;
      to: string[];
    };
    expect(body).toMatchObject({
      subject,
      to: ['reader@example.com'],
    });
    expect(body.html).toContain('https://learn-x.app/confirm');
    expect(body.text).toContain('https://learn-x.app/delete');
    expect(request?.headers).toMatchObject({
      authorization: 'Bearer resend-key',
      'idempotency-key': `public-lead-${locale}-${purpose}`,
    });
  });

  it('surfaces provider rejection with its HTTP status', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 429 }),
    );
    const provider = createResendPublicLeadEmailProvider({
      apiKey: 'resend-key',
      from: 'LearnX <hello@learn-x.app>',
    });

    await expect(
      provider.send(emailInput('fr', 'LAUNCH_UPDATES')),
    ).rejects.toThrow('Email provider rejected the request (429).');
  });
});
