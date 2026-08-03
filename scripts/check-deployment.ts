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
  const baseUrl = getDeploymentUrl(process.argv[2]);
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

  console.log(`Deployment verified: ${baseUrl.origin}`);
}

await checkDeployment();
