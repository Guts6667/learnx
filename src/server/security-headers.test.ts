import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfiguration {
  headers?: Array<{
    headers: VercelHeader[];
    source: string;
  }>;
}

function readSecurityHeaders(): Map<string, string> {
  const configuration = JSON.parse(
    readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
  ) as VercelConfiguration;
  const globalRule = configuration.headers?.find(
    ({ source }) => source === '/(.*)',
  );

  return new Map(
    globalRule?.headers.map(({ key, value }) => [key, value]) ?? [],
  );
}

describe('Vercel security headers', () => {
  it('applies the defense-in-depth headers to every route', () => {
    const headers = readSecurityHeaders();

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headers.get('Permissions-Policy')).toBe(
      'camera=(), geolocation=(), microphone=()',
    );
  });

  it('prevents framing and arbitrary script, object and base origins', () => {
    const policy = readSecurityHeaders().get('Content-Security-Policy');

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
