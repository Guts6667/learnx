import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Publication = {
  id: string;
  publishedAt: string;
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
    expect(manifest.publications).toHaveLength(1);

    const publication = manifest.publications[0];
    expect(publication).toMatchObject({
      id: 'ai-correction-2026-08-12-v1',
      publishedAt: '2026-08-12T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
      version: 1,
      experimental: true,
    });
    expect(publication.translations.fr.canonicalUrl).toBe(
      '/research/ai-correction/',
    );
    expect(publication.translations.en.canonicalUrl).toBe(
      '/research/ai-correction/en.html',
    );
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
      expect(html).toContain(experimentalStatus);
    },
  );

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
