/**
 * Drives the pass 2 page (V4.5-210): forced choice between the two members
 * of a pair. The page must be blind to the key, refuse a partial export, and
 * demand a reason for a tie.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

const PAGE = path.resolve(
  'benchmarks/ai-correction/regression/adjudication-pass2.html',
);

function boot(): void {
  const html = readFileSync(PAGE, 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + '<body>'.length)
    .replace(/<script[\s\S]*$/u, '');
  for (const m of html.matchAll(
    /<script id="([a-zA-Z]+)" type="application\/json">([\s\S]*?)<\/script>/gu,
  )) {
    const el = document.createElement('script');
    el.id = m[1] ?? '';
    el.type = 'application/json';
    el.textContent = m[2] ?? '';
    document.body.appendChild(el);
  }
  const logic = html.slice(html.lastIndexOf('<script>') + '<script>'.length);
  new Function(logic.replace(/<\/script>[\s\S]*$/u, ''))();
}
const press = (key: string): void => {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key }),
  );
};
const click = (selector: string): void => {
  (document.querySelector(selector) as HTMLElement).click();
};
const stored = (): { decisions: Record<string, { choice: string | null }> } =>
  JSON.parse(
    localStorage.getItem(
      Object.keys(localStorage).find((k) => k.startsWith('adj-p2-')) ?? '',
    ) ?? '{"decisions":{}}',
  ) as { decisions: Record<string, { choice: string | null }> };
const waitFor = async (id: string): Promise<HTMLElement> => {
  for (let i = 0; i < 50; i += 1) {
    const el = document.getElementById(id);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`#${id} never appeared`);
};

describe('page de passe 2 (paires en choix forcé)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('montre 45 paires, deux copies, sans un mot de la clé', () => {
    boot();
    expect(document.querySelectorAll('#rail button').length).toBe(45);
    expect(document.querySelectorAll('#app .copy').length).toBe(2);
    const html = readFileSync(PAGE, 'utf8');
    expect(html).not.toMatch(/"member"|control_positive|citedFragment/u);
  });

  it('A et B se choisissent au clavier et se conservent', () => {
    boot();
    press('a');
    expect(document.getElementById('status')?.textContent).toBe(
      'paire complète',
    );
    expect(Object.values(stored().decisions)[0]?.choice).toBe('A');
    press('ArrowRight');
    press('b');
    expect(document.getElementById('progress')?.textContent).toContain(
      '2 complètes',
    );
  });

  it('un « les deux autant » sans pourquoi reste incomplet', () => {
    boot();
    press('=');
    expect(document.getElementById('status')?.textContent).toBe(
      'manque : pourquoi',
    );
    const ta = document.getElementById('rationale') as HTMLTextAreaElement;
    ta.value = 'les deux disent la même chose';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('status')?.textContent).toBe(
      'paire complète',
    );
  });

  it('refuse l’export tant que des paires manquent, puis exporte 45 décisions', async () => {
    boot();
    click('#who');
    (document.getElementById('whoInput') as HTMLInputElement).value = 'r2';
    click('#whoSave');
    press('a');
    click('#toExport');
    expect(document.getElementById('app')?.textContent).toContain(
      '44 paire(s) incomplète(s)',
    );
    for (let i = 0; i < 45; i += 1) {
      (document.querySelectorAll('#rail button')[i] as HTMLElement).click();
      press(i % 2 ? 'b' : 'a');
    }
    click('#toExport');
    const out = (await waitFor('out')) as HTMLTextAreaElement;
    const payload = JSON.parse(out.value) as {
      decisions: { choice: string; leftCardId: string; pairId: string }[];
      pairsHash: string;
      pass: number;
      ties: number;
    };
    expect(payload.pass).toBe(2);
    expect(payload.decisions.length).toBe(45);
    expect(payload.ties).toBe(0);
    expect(payload.pairsHash).toMatch(/^sha256:/u);
    expect(new Set(payload.decisions.map((d) => d.pairId)).size).toBe(45);
  });
});
