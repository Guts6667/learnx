/**
 * Drives the blind adjudication page in a DOM (V4.5-210, pass 1).
 *
 * The page is the instrument the gold labels come from, so its rules are tested
 * like any other guard: a control touched before the verdict must be recorded, a
 * card missing anything must not count, and the export must refuse rather than
 * hand over a partial adjudication.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

const PAGE = path.resolve(
  'benchmarks/ai-correction/regression/adjudication-pass1.html',
);

function boot(): void {
  const html = readFileSync(PAGE, 'utf8');
  const body = html.slice(html.indexOf('<div class="rail"'));
  document.body.innerHTML = body.replace(/<script[\s\S]*$/u, '');

  const deckMatch = html.match(
    /<script id="deck" type="application\/json">([\s\S]*?)<\/script>/u,
  );
  const deck = document.createElement('script');
  deck.id = 'deck';
  deck.type = 'application/json';
  deck.textContent = deckMatch?.[1] ?? '';
  document.body.appendChild(deck);

  const logic = html.slice(html.lastIndexOf('<script>') + '<script>'.length);
  new Function(logic.replace(/<\/script>[\s\S]*$/u, ''))();
}

const press = (key: string): void => {
  // A real browser always targets an element; dispatch the same way.
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key }),
  );
};
const stored = (): Record<string, Record<string, unknown>> => {
  const raw = Object.keys(localStorage)
    .filter((key) => key.startsWith('adj-v2-'))
    .map((key) => localStorage.getItem(key) ?? '{}')[0];
  return (
    (
      JSON.parse(raw ?? '{}') as {
        decisions?: Record<string, Record<string, unknown>>;
      }
    ).decisions ?? {}
  );
};
const firstCardId = (): string => {
  const deck = JSON.parse(
    document.getElementById('deck')?.textContent ?? '{}',
  ) as { cards: { cardId: string }[] };
  return deck.cards[0]?.cardId ?? '';
};

describe('the blind adjudication page', () => {
  beforeEach(() => {
    localStorage.clear();
    boot();
  });

  it('starts both controls unset rather than at a silent default', () => {
    press('d');
    const decision = stored()[firstCardId()];
    expect(decision?.verdict).toBe('DIRECT');
    expect(decision?.alternativeSupport).toBeNull();
    expect(decision?.evidenceViewComplete).toBeNull();
  });

  it('records a control touched BEFORE any verdict', () => {
    // v1 lost this: the handler looked for a decision that did not exist yet.
    press('s');
    expect(stored()[firstCardId()]?.alternativeSupport).toBe('yes');
    press('d');
    expect(stored()[firstCardId()]?.alternativeSupport).toBe('yes');
    expect(stored()[firstCardId()]?.verdict).toBe('DIRECT');
  });

  it('records a control CLICKED before any verdict', () => {
    // The keyboard path and the click path are different handlers; v1 lost the
    // click one. Testing only the keyboard let that mutant survive.
    const yes = document.querySelector('#altTri button') as HTMLElement;
    yes.click();
    expect(stored()[firstCardId()]?.alternativeSupport).toBe('yes');
    const no = document.querySelectorAll('#viewTri button')[1] as HTMLElement;
    no.click();
    expect(stored()[firstCardId()]?.evidenceViewComplete).toBe('no');
    press('d');
    expect(stored()[firstCardId()]?.alternativeSupport).toBe('yes');
    expect(stored()[firstCardId()]?.evidenceViewComplete).toBe('no');
  });

  it('confirms both proposals with a single keystroke', () => {
    press('c');
    const decision = stored()[firstCardId()];
    expect(decision?.alternativeSupport).toBe('no');
    expect(decision?.evidenceViewComplete).toBe('yes');
  });

  it('names every reason a card does not count yet', () => {
    press('d');
    const todo = document.getElementById('todo')?.textContent ?? '';
    expect(todo).toContain('autre soutien');
    expect(todo).toContain('vue complète');
  });

  it('renders role identifiers, never object placeholders', () => {
    const signature = document.querySelector('.sig')?.textContent ?? '';
    expect(signature).not.toContain('[object Object]');
    expect(signature).toMatch(/^[a-z_]+\(/u);
    for (const row of document.querySelectorAll('.role-row')) {
      expect(row.textContent ?? '').not.toContain('[object Object]');
    }
  });

  it('withholds the full response on a windowed card until asked', () => {
    const deck = JSON.parse(
      document.getElementById('deck')?.textContent ?? '{}',
    ) as { cards: { cardId: string; window: unknown }[] };
    const index = deck.cards.findIndex((card) => card.window);
    expect(index).toBeGreaterThanOrEqual(0);
    (document.querySelectorAll('#rail button')[index] as HTMLElement).click();
    expect(document.querySelectorAll('#resp .s.hidden').length).toBeGreaterThan(
      0,
    );
    expect(document.getElementById('reveal')).not.toBeNull();
    document.getElementById('reveal')?.click();
    expect(document.querySelectorAll('#resp .s.hidden')).toHaveLength(0);
    expect(
      stored()[deck.cards[index]?.cardId ?? '']?.revealedBeforeVerdict,
    ).toBe(true);
  });

  it('refuses to export without a reviewer', () => {
    document.getElementById('toExport')?.click();
    const text = document.getElementById('app')?.textContent ?? '';
    expect(text).toContain('Export refusé');
    expect(text).toContain('aucun identifiant de relecteur');
  });

  it('refuses to export a partial adjudication', () => {
    press('d');
    press('c');
    document.getElementById('toExport')?.click();
    const text = document.getElementById('app')?.textContent ?? '';
    expect(text).toContain('Export refusé');
    expect(text).toMatch(/cartes incomplètes sur 106/u);
  });
});
