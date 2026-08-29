import type { PrismaClient, Role } from '../../../../generated/prisma/client';
import type { AccessInvitationEmailInput } from '../../email/email-provider';
import {
  buildAccessInvitationUrl,
  createAccessInvitationDelivery,
  createAccessInvitationToken,
  createPrismaAccessInvitationActivationService,
  getAccessInvitationTtlMilliseconds,
  hashAccessInvitationToken,
} from './access-invitation';

const now = new Date('2026-08-05T10:00:00.000Z');
const rawToken = 'a'.repeat(43);

function createPrismaFixture(options: { expired?: boolean } = {}) {
  const request = {
    activatedUserId: null as string | null,
    emailNormalized: 'learner@example.com',
    id: 'request-1',
    locale: 'fr',
    status: 'APPROVED',
  };
  const invitation = {
    accessRequest: request,
    accessRequestId: request.id,
    assignedRole: 'CREATOR' as Role,
    consumedAt: null as Date | null,
    expiresAt: new Date(now.getTime() + (options.expired ? -1 : 60_000)),
    id: 'invitation-1',
    invalidatedAt: null as Date | null,
    tokenHash: hashAccessInvitationToken(rawToken),
  };
  const users: Array<{
    accountStatus: string;
    displayName: string;
    email: string;
    id: string;
    passwordHash: string;
    role: Role;
    locale: string;
  }> = [];
  const sessions: Array<{
    expiresAt: Date;
    tokenHash: string;
    userId: string;
  }> = [];
  const transaction = {
    accessInvitation: {
      async findUnique() {
        return invitation;
      },
      async updateMany({
        data,
        where,
      }: {
        data: { consumedAt?: Date; invalidatedAt?: Date };
        where: { expiresAt?: { gt: Date }; id?: string | { not: string } };
      }) {
        if (
          where.id === invitation.id &&
          !invitation.consumedAt &&
          !invitation.invalidatedAt &&
          where.expiresAt &&
          invitation.expiresAt > where.expiresAt.gt
        ) {
          invitation.consumedAt = data.consumedAt ?? null;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    accessRequest: {
      async updateMany({ data }: { data: { activatedUserId: string } }) {
        if (request.activatedUserId) return { count: 0 };
        request.activatedUserId = data.activatedUserId;
        return { count: 1 };
      },
    },
    session: {
      async create({
        data,
      }: {
        data: { expiresAt: Date; tokenHash: string; userId: string };
      }) {
        sessions.push(data);
        return { id: 'session-1', ...data };
      },
    },
    user: {
      async create({
        data,
      }: {
        data: {
          accountStatus: string;
          displayName: string;
          email: string;
          passwordHash: string;
          role: Role;
          locale: string;
        };
      }) {
        const user = { id: 'user-1', ...data };
        users.push(user);
        return user;
      },
    },
  };
  const client = {
    accessInvitation: transaction.accessInvitation,
    async $transaction(callback: (value: typeof transaction) => unknown) {
      return callback(transaction);
    },
  } as unknown as PrismaClient;

  return { client, invitation, request, sessions, users };
}

describe('access invitation lifecycle', () => {
  it('keeps the token in the URL fragment and sends no token in the query', async () => {
    const sendAccessInvitationEmail = vi.fn(
      async (input: AccessInvitationEmailInput) => {
        void input;
      },
    );
    const delivery = createAccessInvitationDelivery(
      {
        APP_URL: 'https://learn-x.app',
        LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
        LEARNX_EMAIL_FROM: 'LearnX <no-reply@send.learn-x.app>',
        NODE_ENV: 'production',
        RESEND_API_KEY: 'not-used-by-test-provider',
      },
      { name: 'test', sendAccessInvitationEmail },
    );

    await delivery?.send({
      expiresAt: new Date('2026-08-06T10:00:00.000Z'),
      invitationId: 'invitation-1',
      locale: 'fr',
      recipientEmail: 'learner@example.com',
      token: rawToken,
    });

    const input = sendAccessInvitationEmail.mock.calls[0]?.[0];
    expect(input?.activationUrl).toBe(
      `https://learn-x.app/activate#token=${rawToken}`,
    );
    expect(new URL(input?.activationUrl ?? '').search).toBe('');
  });

  it('creates one active user and one isolated session atomically', async () => {
    const fixture = createPrismaFixture();
    const service = createPrismaAccessInvitationActivationService(
      fixture.client,
      {
        createSessionToken: () => 'new-session-token',
        hashPassword: async (password) => `argon2id:${password}`,
        now: () => now,
      },
    );

    const [first, concurrent] = await Promise.all([
      service.activate({
        displayName: 'Learner',
        password: 'correct-horse-battery-staple',
        token: rawToken,
      }),
      service.activate({
        displayName: 'Learner',
        password: 'correct-horse-battery-staple',
        token: rawToken,
      }),
    ]);

    expect([first, concurrent].filter(Boolean)).toHaveLength(1);
    expect(fixture.users).toEqual([
      expect.objectContaining({
        accountStatus: 'ACTIVE',
        email: 'learner@example.com',
        passwordHash: 'argon2id:correct-horse-battery-staple',
        role: 'CREATOR',
      }),
    ]);
    expect(fixture.request.activatedUserId).toBe('user-1');
    expect(fixture.sessions).toEqual([
      expect.objectContaining({ userId: 'user-1' }),
    ]);
    expect(fixture.sessions[0]?.tokenHash).not.toContain('new-session-token');
    await expect(
      service.activate({
        displayName: 'Learner',
        password: 'correct-horse-battery-staple',
        token: rawToken,
      }),
    ).resolves.toBeNull();
  });

  it('rejects an expired token before hashing a password', async () => {
    const fixture = createPrismaFixture({ expired: true });
    const hashPassword = vi.fn(async () => 'unused');
    const service = createPrismaAccessInvitationActivationService(
      fixture.client,
      { hashPassword, now: () => now },
    );

    await expect(
      service.activate({
        displayName: 'Learner',
        password: 'correct-horse-battery-staple',
        token: rawToken,
      }),
    ).resolves.toBeNull();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(fixture.users).toHaveLength(0);
  });

  it('builds an activation URL without leaking the token to HTTP parameters', () => {
    const url = buildAccessInvitationUrl('https://learn-x.app', rawToken);

    expect(url).toBe(`https://learn-x.app/activate#token=${rawToken}`);
    expect(new URL(url).searchParams.size).toBe(0);
  });

  it('validates delivery configuration and accepts localhost only outside production', () => {
    expect(createAccessInvitationToken()).toHaveLength(43);
    expect(createAccessInvitationDelivery({})).toBeUndefined();
    expect(() =>
      createAccessInvitationDelivery({
        APP_URL: 'https://learn-x.app',
        LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
      }),
    ).toThrow('Access invitation provider is not fully configured.');
    expect(() =>
      createAccessInvitationDelivery(
        { LEARNX_EMAIL_VERIFICATION_ENABLED: 'true' },
        { name: 'test', sendAccessInvitationEmail: vi.fn() },
      ),
    ).toThrow('Access invitation delivery requires APP_URL.');
    expect(() =>
      createAccessInvitationDelivery(
        {
          APP_URL: 'http://learn-x.app',
          LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
          NODE_ENV: 'production',
        },
        { name: 'test', sendAccessInvitationEmail: vi.fn() },
      ),
    ).toThrow('APP_URL must use HTTPS');
    expect(
      createAccessInvitationDelivery(
        {
          APP_URL: 'http://localhost:5173/path',
          LEARNX_EMAIL_VERIFICATION_ENABLED: 'true',
        },
        { name: 'test', sendAccessInvitationEmail: vi.fn() },
      ),
    ).toBeDefined();

    expect(
      getAccessInvitationTtlMilliseconds({
        LEARNX_ACCESS_INVITATION_TTL_MS: '300000',
      }),
    ).toBe(300_000);
    for (const ttl of ['299999', '604800001', 'invalid']) {
      expect(() =>
        getAccessInvitationTtlMilliseconds({
          LEARNX_ACCESS_INVITATION_TTL_MS: ttl,
        }),
      ).toThrow('Invalid access invitation TTL configuration.');
    }
  });

  it('maps activation races to null and rethrows unrelated failures', async () => {
    const fixture = createPrismaFixture();
    const transaction = vi
      .spyOn(fixture.client, '$transaction')
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockRejectedValueOnce(new Error('ACCESS_INVITATION_CONFLICT'))
      .mockRejectedValueOnce(new Error('database unavailable'));
    const service = createPrismaAccessInvitationActivationService(
      fixture.client,
      {
        createSessionToken: () => 'new-session-token',
        hashPassword: async () => 'password-hash',
        now: () => now,
      },
    );
    const input = {
      displayName: 'Learner',
      password: 'correct-horse-battery-staple',
      token: rawToken,
    };

    await expect(service.activate(input)).resolves.toBeNull();
    await expect(service.activate(input)).resolves.toBeNull();
    await expect(service.activate(input)).rejects.toThrow(
      'database unavailable',
    );
    expect(transaction).toHaveBeenCalledTimes(3);
  });
});
