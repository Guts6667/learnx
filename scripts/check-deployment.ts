import { z } from 'zod';

const manifestSchema = z.object({
  display: z.literal('standalone'),
  icons: z.array(
    z.object({
      sizes: z.string().min(1),
      src: z.string().min(1),
    }),
  ),
  name: z.string().min(1),
  start_url: z.literal('/'),
});
const authenticatedSessionSchema = z.object({
  user: z.object({ email: z.email() }),
});
const programsSchema = z.object({ programs: z.array(z.unknown()) });

function getDeploymentUrl(value: string | undefined): URL {
  if (!value) {
    throw new Error(
      'Usage: pnpm deployment:check -- https://deployment.example.com',
    );
  }

  const url = new URL(value);

  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('The deployment URL must use HTTPS.');
  }

  return url;
}

async function expectResponse(
  baseUrl: URL,
  path: string,
  expectedContentType: string,
): Promise<Response> {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { accept: expectedContentType },
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes(expectedContentType)) {
    throw new Error(`${path} returned an unexpected content type.`);
  }

  return response;
}

async function checkDeployment(): Promise<void> {
  const deploymentUrl = process.argv.slice(2).find((value) => value !== '--');
  const baseUrl = getDeploymentUrl(deploymentUrl);
  const page = await expectResponse(baseUrl, '/', 'text/html');
  const html = await page.text();

  if (!html.includes('LearnX')) {
    throw new Error('The application shell does not contain the LearnX title.');
  }

  const manifestResponse = await expectResponse(
    baseUrl,
    '/manifest.webmanifest',
    'application/manifest+json',
  );
  const manifest = manifestSchema.parse(await manifestResponse.json());

  if (manifest.icons.length < 3) {
    throw new Error(
      'The PWA manifest must expose all three application icons.',
    );
  }

  await expectResponse(baseUrl, '/sw.js', 'javascript');
  const sessionResponse = await expectResponse(
    baseUrl,
    '/api/auth/session',
    'application/json',
  );
  const session = z
    .object({ user: z.unknown().nullable() })
    .parse(await sessionResponse.json());

  if (session.user !== null) {
    throw new Error('The anonymous deployment check received a user session.');
  }

  const email = process.env.DEPLOYMENT_CHECK_EMAIL;
  const password = process.env.DEPLOYMENT_CHECK_PASSWORD;

  if (Boolean(email) !== Boolean(password)) {
    throw new Error(
      'DEPLOYMENT_CHECK_EMAIL and DEPLOYMENT_CHECK_PASSWORD must be provided together.',
    );
  }

  if (email && password) {
    const loginResponse = await fetch(new URL('/api/auth/login', baseUrl), {
      body: JSON.stringify({ email, password }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    if (!loginResponse.ok) {
      throw new Error(
        `Authenticated login returned HTTP ${loginResponse.status}.`,
      );
    }

    const responseHeaders = loginResponse.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const rawCookie =
      responseHeaders.getSetCookie?.()[0] ??
      loginResponse.headers.get('set-cookie');
    const cookie = rawCookie?.split(';', 1)[0];

    if (!cookie)
      throw new Error('Authenticated login did not set a session cookie.');

    const authenticatedSessionResponse = await fetch(
      new URL('/api/auth/session', baseUrl),
      { headers: { accept: 'application/json', cookie } },
    );

    if (!authenticatedSessionResponse.ok) {
      throw new Error(
        `Authenticated session returned HTTP ${authenticatedSessionResponse.status}.`,
      );
    }

    const authenticatedSession = authenticatedSessionSchema.parse(
      await authenticatedSessionResponse.json(),
    );

    if (authenticatedSession.user.email !== email.toLowerCase()) {
      throw new Error(
        'The authenticated deployment check received another user.',
      );
    }

    const programsResponse = await fetch(new URL('/api/programs', baseUrl), {
      headers: { accept: 'application/json', cookie },
    });

    if (!programsResponse.ok) {
      throw new Error(
        `Authenticated curriculum returned HTTP ${programsResponse.status}.`,
      );
    }

    programsSchema.parse(await programsResponse.json());

    const logoutResponse = await fetch(new URL('/api/auth/logout', baseUrl), {
      headers: { cookie },
      method: 'POST',
    });

    if (logoutResponse.status !== 204) {
      throw new Error(
        `Authenticated logout returned HTTP ${logoutResponse.status}.`,
      );
    }
  }

  console.log(
    `Deployment verified${email ? ' with authentication' : ''}: ${baseUrl.origin}`,
  );
}

await checkDeployment();
