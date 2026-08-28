import type {
  EmailProvider,
  VerificationEmailInput,
} from '../../email/email-provider';
import {
  buildVerificationUrl,
  consumeEmailVerification,
  createEmailVerificationConsumerDependencies,
  createEmailVerificationDependencies,
  hashVerificationToken,
  issueEmailVerification,
  type EmailVerificationDependencies,
  type EmailVerificationRepository,
} from './email-verification';

const now = new Date('2026-08-05T10:00:00.000Z');
const rawToken = 'a'.repeat(43);

function createContext(options: { deliveryFails?: boolean } = {}) {
  const sent: VerificationEmailInput[] = [];
  const invalidated: string[] = [];
  const issues: Parameters<EmailVerificationRepository['issue']>[0][] = [];
  const consumeInputs: Parameters<EmailVerificationRepository['consume']>[0][] =
    [];
  const logs: unknown[][] = [];
  const emailProvider: EmailProvider = {
    name: 'test-provider',
    async sendVerificationEmail(input) {
      sent.push(input);
      if (options.deliveryFails)
        throw new Error('contains-secret-provider-error');
    },
  };
  const repository: EmailVerificationRepository = {
    async consume(input) {
      consumeInputs.push(input);
      return true;
    },
    async invalidate({ verificationId }) {
      invalidated.push(verificationId);
    },
    async issue(input) {
      issues.push(input);
      return {
        expiresAt: input.expiresAt,
        locale: input.locale,
        recipientEmail: input.email,
        verificationId: input.verificationId,
      };
    },
  };
  const dependencies: EmailVerificationDependencies = {
    appUrl: 'https://learnx.example',
    createAccessRequestId: () => 'request-1',
    createToken: () => rawToken,
    createVerificationId: () => 'verification-1',
    emailProvider,
    logger: { error: (...args) => logs.push(args) },
    now: () => now,
    repository,
    ttlMilliseconds: 60_000,
  };

  return {
    consumeInputs,
    dependencies,
    invalidated,
    issues,
    logs,
    sent,
  };
}

describe('email verification', () => {
  it('stores only the token hash and sends a fragment link', async () => {
    const context = createContext();

    await issueEmailVerification('learner@example.com', 'en', context.dependencies);

    expect(context.issues).toHaveLength(1);
    expect(context.issues[0]?.tokenHash).toBe(hashVerificationToken(rawToken));
    expect(context.issues[0]?.locale).toBe('en');
    expect(JSON.stringify(context.issues)).not.toContain(rawToken);
    expect(context.sent[0]).toEqual(
      expect.objectContaining({
        idempotencyKey: 'verification-1',
        locale: 'en',
        verificationUrl: buildVerificationUrl(
          'https://learnx.example',
          rawToken,
        ),
      }),
    );
    expect(context.sent[0]?.verificationUrl).toContain('/verify-email#token=');
  });

  it('invalidates a token after a simulated delivery failure without logging secrets', async () => {
    const context = createContext({ deliveryFails: true });

    await issueEmailVerification('learner@example.com', 'fr', context.dependencies);

    expect(context.invalidated).toEqual(['verification-1']);
    expect(context.logs).toEqual([
      [
        'Email verification delivery failed.',
        { provider: 'test-provider', verificationId: 'verification-1' },
      ],
    ]);
    expect(JSON.stringify(context.logs)).not.toContain(rawToken);
    expect(JSON.stringify(context.logs)).not.toContain('learner@example.com');
    expect(JSON.stringify(context.logs)).not.toContain('contains-secret');
  });

  it('hashes a token before consuming it', async () => {
    const context = createContext();

    await expect(
      consumeEmailVerification(rawToken, context.dependencies),
    ).resolves.toBe(true);
    expect(context.consumeInputs).toEqual([
      { now, tokenHash: hashVerificationToken(rawToken) },
    ]);
  });

  it('supports a kill switch and validates provider configuration', () => {
    expect(createEmailVerificationDependencies({})).toBeUndefined();
    expect(() =>
      createEmailVerificationDependencies({
        LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
      }),
    ).toThrow('Email verification provider is not fully configured.');
    expect(() =>
      createEmailVerificationDependencies({
        APP_URL: 'http://learnx.example',
        LEARNX_EMAIL_FROM: 'LearnX <access@learnx.example>',
        LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
        NODE_ENV: 'production',
        RESEND_API_KEY: 'secret',
      }),
    ).toThrow('APP_URL must use HTTPS');
  });

  it('builds production and local dependency sets with bounded TTL values', () => {
    const production = createEmailVerificationDependencies({
      APP_URL: 'https://learnx.example/path-is-normalized',
      LEARNX_EMAIL_FROM: 'LearnX <access@learnx.example>',
      LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
      LEARNX_EMAIL_VERIFICATION_TTL_MS: '300000',
      NODE_ENV: 'production',
      RESEND_API_KEY: 'secret',
    });
    expect(production).toMatchObject({
      appUrl: 'https://learnx.example',
      ttlMilliseconds: 300_000,
    });
    expect(production?.createAccessRequestId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(production?.createVerificationId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(production?.createToken()).toHaveLength(43);
    expect(production?.now()).toBeInstanceOf(Date);

    expect(
      createEmailVerificationDependencies({
        APP_URL: 'http://localhost:5173/path',
        LEARNX_EMAIL_FROM: 'LearnX <access@learnx.example>',
        LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
        RESEND_API_KEY: 'secret',
      }),
    ).toMatchObject({ appUrl: 'http://localhost:5173' });

    for (const ttl of ['299999', '604800001', 'not-a-number']) {
      expect(() =>
        createEmailVerificationDependencies({
          APP_URL: 'https://learnx.example',
          LEARNX_EMAIL_FROM: 'LearnX <access@learnx.example>',
          LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
          LEARNX_EMAIL_VERIFICATION_TTL_MS: ttl,
          NODE_ENV: 'production',
          RESEND_API_KEY: 'secret',
        }),
      ).toThrow('Invalid email verification TTL configuration.');
    }

    const consumer = createEmailVerificationConsumerDependencies();
    expect(consumer.now()).toBeInstanceOf(Date);
    expect(consumer.repository).toBeDefined();
  });

  it('does not send an email when the repository declines issuance', async () => {
    const context = createContext();
    context.dependencies.repository.issue = async () => null;

    await issueEmailVerification(
      'registered@example.com',
      'fr',
      context.dependencies,
    );

    expect(context.sent).toHaveLength(0);
  });
});
