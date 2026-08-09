import type { AccessRequestDependencies } from '../../src/server/api/_lib/access-request';
import type { AccessRequestRateLimiter } from '../../src/server/api/_lib/access-request-rate-limit';
import type { EmailVerificationDependencies } from '../../src/server/api/_lib/email-verification';
import { createAccessRequestsApp } from '../../src/server/api/access-requests/app';

const testNow = new Date('2026-08-05T10:00:00.000Z');
const confirmation = {
  message:
    'Votre demande a été prise en compte. Les prochaines étapes vous seront communiquées par e-mail.',
};

interface StoredRequest {
  email: string;
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'PENDING_EMAIL' | 'REJECTED';
}

function createTestContext(initialRequests: StoredRequest[] = []) {
  const requests = [...initialRequests];
  const users = new Set<string>();
  let sequence = 0;
  const dependencies: AccessRequestDependencies = {
    createId() {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    },
    now: () => testNow,
    repository: {
      async createPendingUnlessUserExists({ email }) {
        if (users.has(email)) {
          return;
        }

        const hasOpenRequest = requests.some(
          (request) => request.email === email && request.status !== 'REJECTED',
        );

        if (!hasOpenRequest) {
          requests.push({ email, status: 'PENDING_EMAIL' });
        }
      },
    },
  };
  const rateLimitInputs: Array<{ clientAddress: string; email: string }> = [];
  const rateLimiter: AccessRequestRateLimiter = {
    async consume(input) {
      rateLimitInputs.push(input);
    },
  };

  return { dependencies, rateLimiter, rateLimitInputs, requests, users };
}

async function submit(
  app: ReturnType<typeof createAccessRequestsApp>,
  email: string,
  headers: Record<string, string> = {},
) {
  return app.request('http://localhost/api/access-requests', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('access requests API', () => {
  it('normalizes an email and makes retries idempotent', async () => {
    const context = createTestContext();
    const app = createAccessRequestsApp(context);

    const firstResponse = await submit(app, ' Learner@Example.COM ');
    const retryResponse = await submit(app, 'learner@example.com');

    expect(firstResponse.status).toBe(202);
    expect(retryResponse.status).toBe(202);
    expect(await firstResponse.json()).toEqual(confirmation);
    expect(await retryResponse.json()).toEqual(confirmation);
    expect(context.requests).toEqual([
      { email: 'learner@example.com', status: 'PENDING_EMAIL' },
    ]);
  });

  it('returns an indistinguishable response for existing, open, rejected and new emails', async () => {
    const context = createTestContext([
      { email: 'open@example.com', status: 'PENDING_EMAIL' },
      { email: 'rejected@example.com', status: 'REJECTED' },
    ]);
    context.users.add('active@example.com');
    const app = createAccessRequestsApp(context);

    const responses = await Promise.all(
      [
        'active@example.com',
        'open@example.com',
        'rejected@example.com',
        'new@example.com',
      ].map((email) => submit(app, email)),
    );
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );

    expect(responses.map((response) => response.status)).toEqual([
      202, 202, 202, 202,
    ]);
    expect(bodies).toEqual([
      confirmation,
      confirmation,
      confirmation,
      confirmation,
    ]);
    expect(context.requests).toContainEqual({
      email: 'rejected@example.com',
      status: 'PENDING_EMAIL',
    });
    expect(context.requests).toContainEqual({
      email: 'new@example.com',
      status: 'PENDING_EMAIL',
    });
  });

  it('passes normalized IPv4 and IPv6 addresses only to the rate limiter', async () => {
    const context = createTestContext();
    const app = createAccessRequestsApp(context);

    await submit(app, 'one@example.com', {
      'x-forwarded-for': '203.0.113.4, 10.0.0.1',
    });
    await submit(app, 'two@example.com', {
      'x-vercel-forwarded-for': '[2001:0DB8:0:0::1]:443',
    });

    expect(context.rateLimitInputs).toEqual([
      { clientAddress: '203.0.113.4', email: 'one@example.com' },
      { clientAddress: '2001:db8::1', email: 'two@example.com' },
    ]);
  });

  it('validates the body and supports the server kill switch', async () => {
    const context = createTestContext();
    const app = createAccessRequestsApp(context);
    const disabledApp = createAccessRequestsApp({ ...context, enabled: false });

    const invalidResponse = await app.request(
      'http://localhost/api/access-requests',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email', password: 'forbidden' }),
        headers: { 'content-type': 'application/json' },
      },
    );
    const disabledResponse = await submit(disabledApp, 'valid@example.com');

    expect(invalidResponse.status).toBe(400);
    expect(disabledResponse.status).toBe(503);
    expect(context.requests).toEqual([]);
  });

  it('consumes a valid token once and returns the same safe error for invalid tokens', async () => {
    const context = createTestContext();
    let available = true;
    const emailVerification: EmailVerificationDependencies = {
      appUrl: 'https://learnx.example',
      createAccessRequestId: () => 'request-1',
      createToken: () => 'a'.repeat(43),
      createVerificationId: () => 'verification-1',
      emailProvider: {
        name: 'test-provider',
        async sendVerificationEmail() {},
      },
      logger: { error() {} },
      now: () => testNow,
      repository: {
        async consume() {
          const result = available;
          available = false;
          return result;
        },
        async invalidate() {},
        async issue() {
          return null;
        },
      },
      ttlMilliseconds: 60_000,
    };
    const app = createAccessRequestsApp({ ...context, emailVerification });
    const body = JSON.stringify({ token: 'a'.repeat(43) });

    const first = await app.request(
      'http://localhost/api/access-requests/verify-email',
      { body, method: 'POST', headers: { 'content-type': 'application/json' } },
    );
    const replay = await app.request(
      'http://localhost/api/access-requests/verify-email',
      { body, method: 'POST', headers: { 'content-type': 'application/json' } },
    );

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      message:
        'Ton adresse e-mail est vérifiée. Ta demande est maintenant en attente d’approbation.',
      status: 'verified',
    });
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({
      error: {
        code: 'INVALID_EMAIL_VERIFICATION',
        message: 'Ce lien de vérification est invalide ou a expiré.',
      },
    });
  });

  it('never accepts malformed verification tokens', async () => {
    const context = createTestContext();
    const app = createAccessRequestsApp(context);
    const response = await app.request(
      'http://localhost/api/access-requests/verify-email',
      {
        body: JSON.stringify({ token: 'too-short' }),
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'INVALID_EMAIL_VERIFICATION',
        message: 'Ce lien de vérification est invalide ou a expiré.',
      },
    });
  });

  it('activates an approved invitation and opens a secure session', async () => {
    const context = createTestContext();
    const activate = vi.fn(async () => ({
      sessionToken: 'new-session-token',
      user: {
        displayName: 'Learner',
        email: 'learner@example.com',
        id: '00000000-0000-4000-8000-000000000001',
        locale: 'fr' as const,
        role: 'CREATOR' as const,
      },
    }));
    const app = createAccessRequestsApp({
      ...context,
      activationService: { activate },
      secureCookies: true,
    });
    const response = await app.request('/api/access-invitations/activate', {
      body: JSON.stringify({
        displayName: ' Learner ',
        password: 'correct-horse-battery-staple',
        token: 'a'.repeat(43),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      user: { email: 'learner@example.com', role: 'CREATOR' },
    });
    expect(response.headers.get('set-cookie')).toMatch(
      /^learnx_session=new-session-token;.*HttpOnly.*Secure.*SameSite=Lax/i,
    );
    expect(activate).toHaveBeenCalledWith({
      displayName: 'Learner',
      password: 'correct-horse-battery-staple',
      token: 'a'.repeat(43),
    });
  });

  it.each([
    {
      displayName: 'Learner',
      password: 'too-short',
      token: 'a'.repeat(43),
    },
    {
      displayName: 'Learner',
      password: 'correct-horse-battery-staple',
      token: 'invalid token value',
    },
  ])('returns one safe error for invalid activation input', async (body) => {
    const context = createTestContext();
    const activate = vi.fn(async () => null);
    const app = createAccessRequestsApp({
      ...context,
      activationService: { activate },
    });
    const response = await app.request('/api/access-invitations/activate', {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'INVALID_ACCESS_INVITATION',
        message: 'Cette invitation est invalide ou a expiré.',
      },
    });
    expect(activate).not.toHaveBeenCalled();
  });

  it('returns the same safe error for expired or replayed invitations', async () => {
    const context = createTestContext();
    const app = createAccessRequestsApp({
      ...context,
      activationService: { activate: async () => null },
    });
    const response = await app.request('/api/access-invitations/activate', {
      body: JSON.stringify({
        displayName: 'Learner',
        password: 'correct-horse-battery-staple',
        token: 'a'.repeat(43),
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_ACCESS_INVITATION' },
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
