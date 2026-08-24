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
    expect(map).toContain('320, 390, 720, 1024, 1440 et 1920 px');
    expect(map).toContain('DESIGN VALIDÉ');
  });

  it('publishes the bounded research state in French and English', () => {
    const french = read('public/research/ai-correction/index.html');
    const english = read('public/research/ai-correction/en.html');

    expect(french).toContain('pilote');
    expect(french.toLowerCase()).toContain('writing');
    expect(english).toContain('pilot');
    expect(english.toLowerCase()).toContain('writing');
  });
});
