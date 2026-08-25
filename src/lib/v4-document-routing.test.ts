import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('V4 document routing', () => {
  it('routes current work through the August 24 product roadmap', () => {
    const index = read('docs/INDEX.md');
    const roadmap = read('docs/V4_ROADMAP.md');

    expect(index).toContain('docs/V4_ROADMAP.md');
    expect(index).toContain('BACKLOG_V4.md');
    expect(roadmap).toContain('24 août 2026');
    expect(roadmap).toContain('writing');
    expect(roadmap).toContain('crédits offerts');
    expect(index).toContain('V4_1_BACKLOG.md');
    expect(existsSync(resolve('docs/archive/v4/V4_ROADMAP_2026-08-22.md'))).toBe(
      true,
    );
  });

  it('keeps research evidence separate from the bounded product decision', () => {
    const index = read('docs/INDEX.md');
    const findings = read('docs/V4_RESEARCH_FINDINGS.md');
    const experimentLog = read('docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md');
    const backlogV41 = read('V4_1_BACKLOG.md');

    expect(index).toContain('docs/V4_RESEARCH_FINDINGS.md');
    expect(findings).toContain('NO-GO');
    expect(findings).toContain('pilote');
    expect(experimentLog).toContain('append-only');
    expect(backlogV41).toContain('V4.1');
  });

  it('declares the approved Totem packages as the active UI authority', () => {
    const index = read('docs/INDEX.md');
    const map = read('docs/V4_TOTEM_IMPLEMENTATION_MAP.md');

    expect(index).toContain('docs/V4_TOTEM_IMPLEMENTATION_MAP.md');
    expect(map).toContain('learnx-totem-mobile-authority');
    expect(map).toContain('learnx-totem-desktop-authority');
    expect(map).toContain('learnx-totem-public-authority');
    expect(map).toContain('learnx-brand-assets-authority');
    expect(map).toContain('320, 390, 720, 1024, 1440 et 1920 px');
    expect(map).toContain('DESIGN VALIDÉ');
  });

  it('publishes the bounded research state in French and English', () => {
    const french = read('public/research/ai-correction/index.html');
    const english = read('public/research/ai-correction/en.html');

    expect(french.toLowerCase()).toContain('pilote');
    expect(french.toLowerCase()).toContain('writing');
    expect(french.match(/class="article-card"/g)).toHaveLength(7);
    expect(french).toContain('gates-and-holdout.html');
    expect(french).toContain('writing-exam-bounded-pilot.html');
    expect(english).toContain('pilot');
    expect(english.toLowerCase()).toContain('writing');
    expect(english.match(/class="article-card"/g)).toHaveLength(7);
    expect(english).toContain('gates-and-holdout.en.html');
    expect(english).toContain('writing-exam-bounded-pilot.en.html');

    const frenchLatest = french.indexOf('writing-exam-bounded-pilot.html');
    const frenchOldest = french.indexOf('benchmark-initial.html');
    const englishLatest = english.indexOf(
      'writing-exam-bounded-pilot.en.html',
    );
    const englishOldest = english.indexOf('benchmark-initial.en.html');
    expect(frenchLatest).toBeGreaterThan(-1);
    expect(frenchLatest).toBeLessThan(frenchOldest);
    expect(englishLatest).toBeGreaterThan(-1);
    expect(englishLatest).toBeLessThan(englishOldest);
  });

  it('keeps archived research tables readable on the Totem light surface', () => {
    const archiveTheme = read(
      'public/research/ai-correction/archive-totem.css',
    );

    expect(archiveTheme).toContain(
      'table td { background:#fff !important; color:#42506a !important; }',
    );
    expect(archiveTheme).toContain(
      'table th { background:#e7edff !important; color:#17233b !important; }',
    );
  });

  it('keeps every public research article reachable as a standalone page', () => {
    const articlePaths = [
      'benchmark-initial',
      'composite-pipeline',
      'executable-rubric',
      'current-state',
      'gates-and-holdout',
      'writing-exam-bounded-pilot',
      'complete-report',
    ];

    for (const article of articlePaths) {
      const frenchPath = `public/research/ai-correction/articles/${article}.html`;
      const englishPath = `public/research/ai-correction/articles/${article}.en.html`;
      expect(existsSync(resolve(frenchPath))).toBe(true);
      expect(existsSync(resolve(englishPath))).toBe(true);
      expect(read(frenchPath)).toContain('rel="canonical"');
      expect(read(englishPath)).toContain('hreflang="fr"');
    }
  });

  it('uses the approved brand and share behavior across the research journal', () => {
    const french = read('public/research/ai-correction/index.html');
    const article = read(
      'public/research/ai-correction/articles/writing-exam-bounded-pilot.html',
    );
    const script = read('public/research/ai-correction/journal.js');

    expect(french).toContain('/learnx-mark-on-paper.svg');
    expect(article).toContain('/research/ai-correction/journal.js');
    expect(article).toContain('application/ld+json');
    expect(script).toContain('navigator.share');
    expect(script).toContain('navigator.clipboard.writeText');
  });
});
