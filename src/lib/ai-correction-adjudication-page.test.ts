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
    .filter((key) => key.startsWith('adj-v3-'))
    .map((key) => localStorage.getItem(key) ?? '{}')[0];
  return (
    (
      JSON.parse(raw ?? '{}') as {
        decisions?: Record<string, Record<string, unknown>>;
      }
    ).decisions ?? {}
  );
};
type DeckCard = {
  argumentRoles: { bindable: boolean; cardinality: string; roleId: string }[];
  cardId: string;
  quantifier: string;
  window: unknown;
};
const deckCards = (): DeckCard[] =>
  (
    JSON.parse(document.getElementById('deck')?.textContent ?? '{}') as {
      cards: DeckCard[];
    }
  ).cards;
/** Navigates to the first card matching, and returns it. */
const firstCardWith = (predicate: (card: DeckCard) => boolean): DeckCard => {
  const index = deckCards().findIndex(predicate);
  if (index < 0) throw new Error('aucune carte ne correspond');
  (document.querySelectorAll('#rail button')[index] as HTMLElement).click();
  return deckCards()[index] as DeckCard;
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
    // The warm-up is done: these tests exercise the real deck.
    localStorage.setItem(
      'adj-training',
      JSON.stringify({ decisions: {}, done: true, index: 0 }),
    );
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

  it('offers no pre-selected answer on either control', () => {
    // v2 kept the value null but pressed « non » and « oui » visually, and one
    // key confirmed both. That is a default in everything but storage.
    for (const id of ['#altTri', '#viewTri']) {
      const pressed = document.querySelectorAll(
        `${id} button[aria-pressed="true"]`,
      );
      expect(pressed).toHaveLength(0);
      expect(document.querySelector(id)?.textContent ?? '').toContain(
        'sans réponse',
      );
    }
    expect(document.getElementById('confirm')).toBeNull();
  });

  it('lets a witness be ABSENT without inventing a binding', () => {
    // One bindable role, so the todo list can be checked for that role alone.
    const card = firstCardWith(
      (c) => c.argumentRoles.filter((r) => r.bindable).length === 1,
    );
    const absent = [
      ...document.querySelectorAll('.role-card button.status'),
    ].find(
      (button) => (button as HTMLElement).dataset.status === 'ABSENT',
    ) as HTMLElement;
    absent.click();
    press('n');
    const roles = stored()[card.cardId]?.roleAssessments as Record<
      string,
      { sentenceIds: string[]; status: string }
    >;
    const first = Object.values(roles)[0];
    expect(first?.status).toBe('ABSENT');
    expect(first?.sentenceIds).toEqual([]);
    expect(document.getElementById('todo')?.textContent ?? '').not.toContain(
      'témoin',
    );
  });

  it('refuses a DIRECT whose witness is not bound', () => {
    firstCardWith(
      (c) =>
        c.argumentRoles.some((r) => r.bindable) &&
        c.quantifier !== 'not_exists',
    );
    const absent = [
      ...document.querySelectorAll('.role-card button.status'),
    ].find(
      (button) => (button as HTMLElement).dataset.status === 'ABSENT',
    ) as HTMLElement;
    absent.click();
    press('d');
    expect(document.getElementById('todo')?.textContent ?? '').toContain(
      'un « oui » exige le témoin',
    );
  });

  it('enforces the role cardinality on a bound witness', () => {
    const card = firstCardWith((c) =>
      c.argumentRoles.some((r) => r.bindable && r.cardinality === '>=2'),
    );
    const roleId = card.argumentRoles.find(
      (role) => role.bindable && role.cardinality === '>=2',
    )?.roleId;
    const bound = [
      ...document.querySelectorAll('.role-card button.status'),
    ].find(
      (button) =>
        (button as HTMLElement).dataset.status === 'BOUND' &&
        (button as HTMLElement).dataset.for === roleId,
    ) as HTMLElement;
    bound.click();
    (document.querySelector('#resp .s') as HTMLElement).click();
    expect(document.getElementById('todo')?.textContent ?? '').toContain(
      'au moins 2 phrases',
    );
  });

  it('names every reason a card does not count yet', () => {
    press('d');
    const todo = document.getElementById('todo')?.textContent ?? '';
    expect(todo).toContain('autre phrase');
    expect(todo).toContain('rien ne m’a manqué');
  });

  it('renders role identifiers, never object placeholders', () => {
    const signature = document.querySelector('.sig')?.textContent ?? '';
    expect(signature).not.toContain('[object Object]');
    expect(signature).toMatch(/[a-z_]+\(/u);
    for (const row of document.querySelectorAll('.role-card')) {
      expect(row.textContent ?? '').not.toContain('[object Object]');
    }
  });

  it('withholds the full response on a windowed card until asked', () => {
    // A windowed card whose window really does hide something: 19 of the 45
    // have a response shorter than the window, where there is nothing to hide.
    const cards = deckCards() as (DeckCard & {
      response: string;
      sentences: { end: number; start: number }[];
      window: { end: number; start: number } | null;
    })[];
    const index = cards.findIndex(
      (card) =>
        card.window !== null &&
        card.sentences.some(
          (sentence) =>
            sentence.start >= (card.window as { end: number }).end ||
            sentence.end <= (card.window as { start: number }).start,
        ),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    (document.querySelectorAll('#rail button')[index] as HTMLElement).click();
    expect(document.querySelectorAll('#resp .s.hidden').length).toBeGreaterThan(
      0,
    );
    expect(document.getElementById('reveal')).not.toBeNull();
    document.getElementById('reveal')?.click();
    expect(document.querySelectorAll('#resp .s.hidden')).toHaveLength(0);
    expect(stored()[cards[index]?.cardId ?? '']?.revealedBeforeVerdict).toBe(
      true,
    );
  });

  it('labels a sentence with every role it is bound to', () => {
    // On the first real card a sentence bound to two roles showed one label,
    // hiding half of the reviewer's own choice.
    firstCardWith(
      (c) => c.argumentRoles.filter((r) => r.bindable).length === 2,
    );
    const roles = [
      ...document.querySelectorAll('.role-card button[data-role]'),
    ] as HTMLElement[];
    for (const role of roles) {
      const bound = [
        ...document.querySelectorAll('.role-card button.status'),
      ].find(
        (b) =>
          (b as HTMLElement).dataset.status === 'BOUND' &&
          (b as HTMLElement).dataset.for === role.dataset.role,
      ) as HTMLElement;
      bound.click();
      (document.querySelector('#resp .s') as HTMLElement).click();
    }
    const first = document.querySelector('#resp .s')?.textContent ?? '';
    for (const role of roles) expect(first).toContain(role.dataset.role ?? '');
    expect(first).toContain(' + ');
  });

  it('shows plain-language help on demand, with the quantifier explained', () => {
    expect(document.body.dataset.help).toBe('off');
    // Visibility is a CSS rule on body[data-help]; jsdom does not resolve that
    // cascade, so the test asserts the state the page controls.
    const guide = document.querySelector('.guide') as HTMLElement;
    press('?');
    expect(document.body.dataset.help).toBe('on');
    expect(guide.textContent ?? '').toContain('Comment traiter une carte');
    const card = deckCards()[0] as DeckCard;
    const hints = [...document.querySelectorAll('.hint')].map(
      (h) => h.textContent ?? '',
    );
    const expected = {
      exists: 'UNE occurrence',
      forall: 'TOUTES',
      forall_exists: 'CHAQUE élément',
      not_exists: 'AUCUNE',
    }[card.quantifier];
    expect(hints.some((text) => text.includes(expected ?? '∅'))).toBe(true);
    press('?');
    expect(document.body.dataset.help).toBe('off');
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

describe('the warm-up before the real deck', () => {
  beforeEach(() => {
    localStorage.clear();
    boot();
  });

  it('opens on the warm-up, not the real deck, and never on a real card', () => {
    expect(document.querySelector('.training')).not.toBeNull();
    expect(document.querySelectorAll('#rail button')).toHaveLength(8);
    const shown =
      document.querySelector('.chip:nth-of-type(2)')?.textContent ?? '';
    expect(shown.startsWith('E')).toBe(true);
    expect(document.getElementById('progress')?.textContent ?? '').toContain(
      'entraînement 1 / 8',
    );
  });

  it('corrects a warm-up card once complete, without touching the real store', () => {
    // E1: no choice is stated → choice ABSENT, verdict N, S no, V yes.
    const absent = [
      ...document.querySelectorAll('.role-card button.status'),
    ].find(
      (b) => (b as HTMLElement).dataset.status === 'ABSENT',
    ) as HTMLElement;
    absent.click();
    press('n');
    (document.querySelectorAll('#altTri button')[1] as HTMLElement).click();
    (document.querySelectorAll('#viewTri button')[0] as HTMLElement).click();
    const rows = [...document.querySelectorAll('table.grade tr')];
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((row) => row.classList.contains('ok'))).toBe(true);
    expect(document.querySelector('.lesson')?.textContent ?? '').toContain(
      'absent',
    );
    expect(document.getElementById('trainNext')).not.toBeNull();
    expect(Object.keys(stored())).toHaveLength(0);
  });

  it('shows the mistake when the answer is wrong', () => {
    press('d');
    const bound = [
      ...document.querySelectorAll('.role-card button.status'),
    ].find((b) => (b as HTMLElement).dataset.status === 'BOUND') as HTMLElement;
    bound.click();
    (document.querySelector('#resp .s') as HTMLElement).click();
    (document.querySelectorAll('#altTri button')[1] as HTMLElement).click();
    (document.querySelectorAll('#viewTri button')[0] as HTMLElement).click();
    const ko = document.querySelectorAll('table.grade tr.ko');
    expect(ko.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses the export while the warm-up is running', () => {
    document.getElementById('toExport')?.click();
    expect(document.getElementById('app')?.textContent ?? '').toContain(
      'Export indisponible',
    );
  });

  it('unlocks the real deck once the last warm-up card is corrected', () => {
    const specs = [
      { s: 'ABSENT', v: 'n', alt: 1 },
      { s: null, v: 'n', alt: 1 },
      { s: null, v: 'd', alt: 0 },
      { s: null, v: 'n', alt: 1 },
      { s: 'ABSENT', v: 'd', alt: 1 },
      { s: null, v: 'd', alt: 1 },
      { s: null, v: 'd', alt: 1 },
      { s: null, v: 'n', alt: 1 },
    ];
    for (let i = 0; i < 8; i += 1) {
      // Bind every bindable role to the first sentence, or mark it absent: the
      // point here is completion, not correctness.
      const statuses = [
        ...document.querySelectorAll('.role-card button.status'),
      ] as HTMLElement[];
      const roles = [...new Set(statuses.map((b) => b.dataset.for))];
      for (const roleId of roles) {
        const wanted = specs[i]?.s ?? 'BOUND';
        (
          statuses.find(
            (b) => b.dataset.for === roleId && b.dataset.status === wanted,
          ) as HTMLElement
        ).click();
        if (wanted === 'BOUND') {
          // Single-sentence families only accept the examined sentence; the
          // others take any sentence. Pick accordingly.
          const single = (
            document.querySelector('.role-card.armed .role-q')?.textContent ??
            ''
          ).includes('phrase examinée');
          const sentences = document.querySelectorAll(
            single ? '#resp .s.cand' : '#resp .s:not(.hidden)',
          );
          (
            sentences[
              Math.min(sentences.length - 1, roles.indexOf(roleId) + 1)
            ] as HTMLElement
          ).click();
          if (
            (document.getElementById('todo')?.textContent ?? '').includes(
              'au moins 2',
            )
          ) {
            (
              document.querySelectorAll(
                '#resp .s:not(.hidden)',
              )[0] as HTMLElement
            ).click();
          }
        }
      }
      press(specs[i]?.v ?? 'n');
      (
        document.querySelectorAll('#altTri button')[
          specs[i]?.alt ?? 1
        ] as HTMLElement
      ).click();
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
