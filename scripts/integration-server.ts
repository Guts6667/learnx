import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

import api from '../api/index.js';
import { requireEphemeralIntegrationDatabase } from '../src/server/integration-database.js';

const port = Number(process.env.INTEGRATION_SERVER_PORT ?? 4173);
const distributionDirectory = path.resolve(process.cwd(), 'dist');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

async function handleApi(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  const requestUrl = new URL(
    incoming.url ?? '/',
    `http://${incoming.headers.host ?? `127.0.0.1:${port}`}`,
  );
  const method = incoming.method ?? 'GET';
  const startedAt = Date.now();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    headers: requestHeaders(incoming),
    method,
  };

  if (hasBody) {
    init.body = Readable.toWeb(incoming) as unknown as RequestInit['body'];
    init.duplex = 'half';
  }

  const response = await api.fetch(new Request(requestUrl, init));
  console.log(
    `[integration:request] ${method} ${requestUrl.pathname} ${response.status} ${Date.now() - startedAt}ms`,
  );
  outgoing.statusCode = response.status;

  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') outgoing.setHeader(name, value);
  });

  const responseHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = responseHeaders.getSetCookie?.() ?? [];

  if (cookies.length > 0) outgoing.setHeader('set-cookie', cookies);
  else {
    const cookie = response.headers.get('set-cookie');
    if (cookie) outgoing.setHeader('set-cookie', cookie);
  }

  if (!response.body) {
    outgoing.end();
    return;
  }

  Readable.fromWeb(response.body as never).pipe(outgoing);
}

async function findStaticFile(url: URL): Promise<string> {
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const candidate = path.resolve(distributionDirectory, `.${requestedPath}`);

  if (!candidate.startsWith(`${distributionDirectory}${path.sep}`)) {
    return path.join(distributionDirectory, 'index.html');
  }

  try {
    if ((await stat(candidate)).isFile()) return candidate;
  } catch {
    // The SPA fallback below handles unknown client routes.
  }

  return path.join(distributionDirectory, 'index.html');
}

async function handleStatic(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  const url = new URL(
    incoming.url ?? '/',
    `http://${incoming.headers.host ?? `127.0.0.1:${port}`}`,
  );
  const filename = await findStaticFile(url);
  const content = await readFile(filename);
  outgoing.statusCode = 200;
  outgoing.setHeader(
    'content-type',
    contentTypes[path.extname(filename)] ?? 'application/octet-stream',
  );
  outgoing.setHeader('cache-control', 'no-store');
  outgoing.end(content);
}

requireEphemeralIntegrationDatabase();

const server = createServer((incoming, outgoing) => {
  const task = incoming.url?.startsWith('/api/')
    ? handleApi(incoming, outgoing)
    : handleStatic(incoming, outgoing);

  void task.catch((error: unknown) => {
    console.error(error);
    if (!outgoing.headersSent) outgoing.statusCode = 500;
    outgoing.end('Integration server error.');
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `LearnX integration server listening on http://127.0.0.1:${port}`,
  );
});

function stop(): void {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
