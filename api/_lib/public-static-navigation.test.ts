import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public static research reports', () => {
  it('keeps reports outside the Vercel SPA catch-all', () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as {
      rewrites: Array<{ destination: string; source: string }>;
    };
    const spaRewrite = vercelConfig.rewrites.find(
      (rewrite) => rewrite.destination === '/index.html',
    );

    expect(spaRewrite).toBeDefined();
    const catchAll = new RegExp(`^${spaRewrite?.source}$`);
    expect(catchAll.test('/research/ai-correction/')).toBe(false);
    expect(catchAll.test('/research/ai-correction/en.html')).toBe(false);
    expect(
      catchAll.test('/research/ai-correction/evidence-assist-gate-4/'),
    ).toBe(false);
    expect(
      catchAll.test('/research/ai-correction/evidence-assist-gate-4/en.html'),
    ).toBe(false);
    expect(catchAll.test('/today')).toBe(true);
    expect(catchAll.test('/program/example')).toBe(true);
  });

  it('ships both localized static files', () => {
    expect(
      readFileSync(
        resolve(process.cwd(), 'public/research/ai-correction/index.html'),
        'utf8',
      ),
    ).toContain('<html lang="fr">');
    expect(
      readFileSync(
        resolve(process.cwd(), 'public/research/ai-correction/en.html'),
        'utf8',
      ),
    ).toContain('<html lang="en">');
    expect(
      readFileSync(
        resolve(
          process.cwd(),
          'public/research/ai-correction/evidence-assist-gate-4/index.html',
        ),
        'utf8',
      ),
    ).toContain('<html lang="fr">');
    expect(
      readFileSync(
        resolve(
          process.cwd(),
          'public/research/ai-correction/evidence-assist-gate-4/en.html',
        ),
        'utf8',
      ),
    ).toContain('<html lang="en">');
  });
});
