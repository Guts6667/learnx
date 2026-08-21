import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Publication = {
  id: string;
  sequence: number;
  type: 'exploration' | 'protocol' | 'result' | 'decision' | 'erratum';
  publishedAt: string;
  researchAt: string;
  updatedAt: string;
  version: number;
  experimental: boolean;
  translations: Record<
    'fr' | 'en',
    { canonicalUrl: string; alternateLocaleUrl: string }
  >;
};

const readPublicFile = (path: string) =>
  readFileSync(resolve(process.cwd(), 'public', path), 'utf8');

const manifest = JSON.parse(readPublicFile('research/journal.v1.json')) as {
  schemaVersion: number;
  publications: Publication[];
};

describe('public research journal', () => {
  it('publishes a bilingual, versioned and immutable chronology', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.publications).toHaveLength(7);

    const latest = manifest.publications[0];
    expect(latest).toMatchObject({
      id: 'ai-correction-evidence-assist-gate-4-2026-08-21-v1',
      sequence: 6,
      type: 'result',
      researchAt: '2026-08-20T00:00:00Z',
      publishedAt: '2026-08-21T00:00:00Z',
      updatedAt: '2026-08-21T00:00:00Z',
      version: 1,
      experimental: true,
    });
    expect(latest.translations.fr.canonicalUrl).toBe(
      '/research/ai-correction/evidence-assist-gate-4/',
    );
    expect(latest.translations.en.canonicalUrl).toBe(
      '/research/ai-correction/evidence-assist-gate-4/en.html',
    );

    expect(manifest.publications.map(({ sequence }) => sequence)).toEqual([
      6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(
      new Set(
        manifest.publications.flatMap(({ translations }) => [
          translations.fr.canonicalUrl,
          translations.en.canonicalUrl,
        ]),
      ).size,
    ).toBe(14);
  });

  it.each([
    [
      'fr',
      'research/index.html',
      '/research/',
      '/research/en.html',
      'Recherche expérimentale',
    ],
    [
      'en',
      'research/en.html',
      '/research/en.html',
      '/research/',
      'Experimental research',
    ],
  ])(
    'exposes the %s journal index with canonical and alternate links',
    (_locale, file, canonical, alternate, experimentalStatus) => {
      const html = readPublicFile(file);
      expect(html).toContain('rel="canonical"');
      expect(html).toContain(`href="${canonical}"`);
      expect(html).toContain(`hreflang="fr" href="/research/"`);
      expect(html).toContain(`hreflang="en" href="/research/en.html"`);
      expect(html).toContain(`href="${alternate}"`);
      expect(html).toContain('data-publication-type="exploration"');
      expect(html).toContain('data-publication-type="protocol"');
      expect(html).toContain('data-publication-type="result"');
      expect(html).toContain('data-publication-type="decision"');
      expect(html).toContain(experimentalStatus);
      expect(html.match(/class="publication"/g)).toHaveLength(7);
    },
  );

  it('ships every journal article as a bilingual, directly shareable page', () => {
    for (const publication of manifest.publications.filter(
      ({ sequence }) => sequence > 0,
    )) {
      for (const locale of ['fr', 'en'] as const) {
        const translation = publication.translations[locale];
        const publicPath = translation.canonicalUrl.endsWith('.html')
          ? translation.canonicalUrl.slice(1)
          : `${translation.canonicalUrl.slice(1)}index.html`;
        const html = readPublicFile(publicPath);

        expect(html).toContain(`<html lang="${locale}">`);
        expect(html).toContain('property="og:type" content="article"');
        expect(html).toContain('property="og:url"');
        expect(html).toMatch(/"@type"\s*:\s*"Article"/);
        expect(html).toContain('data-share-article');
        expect(html).toContain('data-share-status aria-live="polite"');
        expect(html).toContain(
          `href="https://learnx-eight.vercel.app${translation.canonicalUrl}"`,
        );
        expect(html).toContain(
          `href="https://learnx-eight.vercel.app${translation.alternateLocaleUrl}"`,
        );
      }
    }
  });

  it.each([
    [
      'research/ai-correction/index.html',
      '/research/ai-correction/',
      '/research/',
      'aucun erratum publié',
    ],
    [
      'research/ai-correction/en.html',
      '/research/ai-correction/en.html',
      '/research/en.html',
      'no erratum published',
    ],
  ])(
    'preserves the historical article and links it back to the journal',
    (file, canonical, journal, errataStatus) => {
      const html = readPublicFile(file);
      expect(html).toContain('rel="canonical"');
      expect(html).toContain(`href="${canonical}"`);
      expect(html).toContain(`href="${journal}"`);
      expect(html).toContain('"@type": "Article"');
      expect(html).toContain(errataStatus);
    },
  );
});
