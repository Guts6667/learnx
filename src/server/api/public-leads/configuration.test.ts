import { createPublicLeadServiceDependencies } from './configuration.js';

describe('public lead service configuration', () => {
  it.each([
    { LEARNX_PUBLIC_LEADS_ENABLED: 'false' },
    { APP_URL: 'https://learn-x.app', LEARNX_EMAIL_FROM: 'hello@learn-x.app' },
    { LEARNX_EMAIL_FROM: 'hello@learn-x.app', RESEND_API_KEY: 'key' },
    { APP_URL: 'https://learn-x.app', RESEND_API_KEY: 'key' },
  ])('stays disabled for an incomplete environment %#', (environment) => {
    expect(
      createPublicLeadServiceDependencies(environment as NodeJS.ProcessEnv),
    ).toBeUndefined();
  });

  it('normalizes the application origin and exposes bounded token factories', () => {
    const dependencies = createPublicLeadServiceDependencies({
      APP_URL: 'https://learn-x.app/some/path?query=true',
      LEARNX_EMAIL_FROM: 'LearnX <hello@learn-x.app>',
      RESEND_API_KEY: 'resend-key',
    });

    expect(dependencies).toBeDefined();
    expect(dependencies?.appUrl).toBe('https://learn-x.app');
    expect(dependencies?.createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(dependencies?.createToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(dependencies?.now()).toBeInstanceOf(Date);
    expect(dependencies?.ttlMilliseconds).toBe(86_400_000);
  });
});
