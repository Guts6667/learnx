/**
 * Drives the blind adjudication page (v4) in a DOM (V4.5-210, pass 1).
 *
 * The page is the instrument the gold labels come from, so its rules are
 * tested like any other guard: one plain question per card, evidence
 * sentences instead of role binding, controls with no default, an export that
 * refuses partial or over-abstaining passes, and a warm-up that gates the deck.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

const PAGE = path.resolve(
  'benchmarks/ai-correction/regression/adjudication-pass1.html',
);

function boot(): void {
  const html = readFileSync(PAGE, 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<div class="rail"'))
    .replace(/<script[\s\S]*$/u, '');
  for (const id of ['deck', 'questions']) {
    const m = html.match(
      new RegExp(
        `<script id="${id}" type="application\\/json">([\\s\\S]*?)<\\/script>`,
        'u',
      ),
    );
    const el = document.createElement('script');
    el.id = id;
    el.type = 'application/json';
    el.textContent = m?.[1] ?? '';
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
type DeckCard = {
  cardId: string;
  stratum: string;
  window: unknown;
  atomId: string;
  argumentRoles: { bindable: boolean }[];
};
const deckCards = (): DeckCard[] =>
  (
    JSON.parse(document.getElementById('deck')?.textContent ?? '{}') as {
      cards: DeckCard[];
    }
  ).cards;
const stored = (): Record<string, Record<string, unknown>> => {
  const key = Object.keys(localStorage).find((k) => k.startsWith('adj-v4-'));
  return (
    (
      JSON.parse((key && localStorage.getItem(key)) || '{}') as {
        decisions?: Record<string, Record<string, unknown>>;
      }
    ).decisions ?? {}
  );
};
const goTo = (predicate: (card: DeckCard) => boolean): DeckCard => {
  const index = deckCards().findIndex(predicate);
  if (index < 0) throw new Error('aucune carte ne correspond');
  (document.querySelectorAll('#rail button')[index] as HTMLElement).click();
  return deckCards()[index] as DeckCard;
};
/** A « non » that satisfies every family: one clicked sentence where required. */
const answerNo = (): void => {
  // Two-role cards need one sentence per related thing: click up to two.
  const clickable = [...document.querySelectorAll('#resp .s.clickable')].slice(
    0,
    2,
  ) as HTMLElement[];
  for (const c of clickable) c.click();
  press('n');
};
const setControls = (): void => {
  const alt = document.querySelectorAll('#altTri button');
  if (alt.length) (alt[1] as HTMLElement).click();
  (document.querySelectorAll('#viewTri button')[0] as HTMLElement).click();
};

describe('the blind adjudication page, real deck', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'adj-training-v4',
      JSON.stringify({ decisions: {}, done: true, index: 0 }),
    );
    boot();
  });

  it('shows one plain French question per card, from the sealed question file', () => {
    const card = deckCards()[0] as DeckCard;
    const questions = JSON.parse(
      document.getElementById('questions')?.textContent ?? '{}',
    ) as { questions: Record<string, string> };
    expect(document.querySelector('.question')?.textContent).toBe(
      questions.questions[card.atomId],
    );
    expect(
      document.getElementById('verdictQuestion')?.textContent ?? '',
    ).toContain(questions.questions[card.atomId] ?? '∅');
  });

  it('starts both controls unset and records a control clicked before any verdict', () => {
    const id = (deckCards()[0] as DeckCard).cardId;
    (document.querySelector('#altTri button') as HTMLElement).click();
    expect(stored()[id]?.alternativeSupport).toBe('yes');
    expect(stored()[id]?.evidenceViewComplete).toBeNull();
    press('o');
    expect(stored()[id]?.verdict).toBe('DIRECT');
    expect(stored()[id]?.alternativeSupport).toBe('yes');
  });

  it('requires highlighted evidence for a yes on a multi-sentence card, none on a single-sentence one', () => {
    const multi = goTo((c) => /^S[456]_/.test(c.stratum));
    press('o');
    expect(document.getElementById('todo')?.textContent ?? '').toContain(
      'surligne',
    );
    for (const c of [...document.querySelectorAll('#resp .s.clickable')].slice(
      0,
      2,
    ))
      (c as HTMLElement).click();
    expect(document.getElementById('todo')?.textContent ?? '').not.toContain(
      'surligne',
    );
    expect(
      (stored()[multi.cardId]?.evidenceSentenceIds as string[]).length,
    ).toBeGreaterThanOrEqual(1);
    goTo((c) => /^S[123]_/.test(c.stratum));
    expect(document.querySelectorAll('#resp .s.clickable')).toHaveLength(0);
    press('o');
    expect(document.getElementById('todo')?.textContent ?? '').not.toContain(
      'surligne',
    );
  });

  it('withholds the copy outside the window on a single-sentence card until asked', () => {
    goTo((c) => c.window !== null);
    const hidden = document.querySelectorAll('#resp .s.hidden').length;
    if (hidden > 0) {
      document.getElementById('reveal')?.click();
      expect(document.querySelectorAll('#resp .s.hidden')).toHaveLength(0);
    }
  });

  it('refuses to export without a reviewer or with incomplete cards', () => {
    document.getElementById('toExport')?.click();
    const text = document.getElementById('app')?.textContent ?? '';
    expect(text).toContain('Export refusé');
    expect(text).toContain('aucun identifiant de relecteur');
    expect(text).toMatch(/cartes incomplètes sur 106/u);
  });

  it('derives the witness on a single-role card and defers two-role cards to pass 2', async () => {
    // Complete every card with a « non », then export and inspect the derivation.
    (window as unknown as { prompt: () => string }).prompt = () => 'test';
    document.getElementById('who')?.click();
    for (let i = 0; i < 106; i += 1) {
      (document.querySelectorAll('#rail button')[i] as HTMLElement).click();
      answerNo();
      setControls();
    }
    document.getElementById('toExport')?.click();
    // The export hashes its text with crypto.subtle: the panel appears asynchronously.
    let out = '';
    for (let i = 0; i < 40 && !out; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      out =
        (document.getElementById('out') as HTMLTextAreaElement | null)?.value ??
        '';
    }
    expect(out.length).toBeGreaterThan(0);
    const payload = JSON.parse(out) as {
      decisions: {
        cardId: string;
        roleAssessments: Record<string, { derivation: string; status: string }>;
        secondsOnCard: number;
        orderIndex: number;
      }[];
      abstentionShare: number;
    };
    expect(payload.abstentionShare).toBe(0);
    const byId = new Map(payload.decisions.map((d) => [d.cardId, d]));
    for (const card of deckCards()) {
      const roles = card.argumentRoles.filter((r) => r.bindable).length;
      const derived = Object.values(
        byId.get(card.cardId)?.roleAssessments ?? {},
      );
      if (roles === 1) expect(derived[0]?.derivation).toBe('single-role');
      if (roles === 2)
        expect(derived.every((r) => r.status === 'PENDING_PASS2')).toBe(true);
      if (roles === 0) expect(derived).toHaveLength(0);
    }
    expect(
      payload.decisions.every((d) => typeof d.orderIndex === 'number'),
    ).toBe(true);
  });

  it('suspends the pass above the pre-declared abstention cap', () => {
    (window as unknown as { prompt: () => string }).prompt = () => 'test';
    document.getElementById('who')?.click();
    for (let i = 0; i < 106; i += 1) {
      (document.querySelectorAll('#rail button')[i] as HTMLElement).click();
      if (i < 25) {
        press('?');
        const why = document.getElementById('why') as HTMLInputElement;
        why.value = 'test';
        why.dispatchEvent(new Event('input'));
      } else answerNo();
      setControls();
    }
    document.getElementById('toExport')?.click();
    expect(document.getElementById('app')?.textContent ?? '').toContain(
      'passe suspendue',
    );
  });
});

describe('the warm-up before the real deck', () => {
  beforeEach(() => {
    localStorage.clear();
    boot();
  });

  it('opens on the warm-up with eight cards and refuses the export', () => {
    expect(document.querySelector('.training')).not.toBeNull();
    expect(document.querySelectorAll('#rail button')).toHaveLength(8);
    document.getElementById('toExport')?.click();
    expect(document.getElementById('app')?.textContent ?? '').toContain(
      'Export indisponible',
    );
  });

  it('corrects E1 and colours the bar by correctness', () => {
    press('n');
    setControls();
    const rows = [...document.querySelectorAll('table.grade tr')];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.classList.contains('ok'))).toBe(true);
    expect(
      (document.querySelector('#rail button') as HTMLElement).dataset.g,
    ).toBe('ok');
    expect(Object.keys(stored())).toHaveLength(0);
  });

  it('shows the mistake and, on E2, expects the irrelevant sentence highlighted', () => {
    (document.querySelectorAll('#rail button')[1] as HTMLElement).click();
    (document.querySelector('#resp .s[data-s="s0"]') as HTMLElement).click();
    (document.querySelector('#resp .s[data-s="s1"]') as HTMLElement).click();
    press('n');
    setControls();
    let rows = [...document.querySelectorAll('table.grade tr')];
    expect(rows.some((r) => r.classList.contains('ko'))).toBe(true);
    (document.querySelector('#resp .s[data-s="s2"]') as HTMLElement).click();
    rows = [...document.querySelectorAll('table.grade tr')];
    expect(rows.every((r) => r.classList.contains('ok'))).toBe(true);
  });

  it('unlocks the real deck after the eighth card', () => {
    const verdicts = ['n', 'n', 'o', 'n', 'o', 'o', 'o', 'n'];
    const evidence: Record<number, string[]> = {
      1: ['s0', 's2'],
      5: ['s1', 's2'],
      7: ['s0', 's1'],
    };
    for (let i = 0; i < 8; i += 1) {
      (document.querySelectorAll('#rail button')[i] as HTMLElement).click();
      for (const id of evidence[i] ?? [])
        (
          document.querySelector(`#resp .s[data-s="${id}"]`) as HTMLElement
        ).click();
      press(verdicts[i] ?? 'n');
      const alt = document.querySelectorAll('#altTri button');
      if (alt.length) (alt[i === 2 ? 0 : 1] as HTMLElement).click();
      (document.querySelectorAll('#viewTri button')[0] as HTMLElement).click();
      const next =
        document.getElementById('trainNext') ??
        document.getElementById('trainDone');
      expect(next).not.toBeNull();
      next?.click();
    }
    expect(document.querySelector('.training')).toBeNull();
    expect(document.querySelectorAll('#rail button')).toHaveLength(106);
  });
});
