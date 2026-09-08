/**
 * V4.5-210 — the atomic verifier measurement, pure parts. The labelled set
 * must be exactly what pass 2 declared, the prompt must never carry the key,
 * a malformed answer must never become a verdict, and the pre-declared
 * readings must fire on the numbers they name.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  binomialUpperTail,
  estimateCostUsd,
  majorityVerdict,
  pairOutcome,
  parseVerifierAnswer,
  renderVerifierCard,
  seededShuffle,
  selectLabelledPairs,
  summariseModel,
  THRESHOLDS,
  type CardObservation,
  type KeyEntry,
  type LabelledPair,
  type PairRecord,
  type Pass2Decision,
  type VerifierCard,
  type VerifierVerdict,
  VERIFIER_SYSTEM_PROMPT,
} from './ai-correction-atom-verifier.js';

const REG = 'benchmarks/ai-correction/regression';
const read = <T>(file: string): T =>
  JSON.parse(readFileSync(path.resolve(REG, file), 'utf8')) as T;

const deck = read<{ cards: VerifierCard[] }>('adjudication-deck.v3.json');
const key = read<{ key: KeyEntry[] }>('adjudication-deck.v3.key.json');
const pairs = read<{ pairs: PairRecord[] }>('adjudication-pairs.v1.json');
const pass2 = read<{ decisions: Pass2Decision[] }>(
  'adjudication-pass2.owner.2026-09-05.json',
);
const questions = read<{ questions: Record<string, string> }>(
  'plain-questions.v1.json',
);

const labelled = selectLabelledPairs({
  decisions: pass2.decisions,
  key: key.key,
  pairs: pairs.pairs,
});

describe('labelled set', () => {
  it('is the 30 primary pairs where the owner chose the original', () => {
    expect(labelled).toHaveLength(THRESHOLDS.labelledPairs);
    const member = new Map(key.key.map((k) => [k.cardId, k.member]));
    for (const p of labelled) {
      expect(member.get(p.originalCardId)).toBe('positive');
      expect(member.get(p.damagedCardId)).toBe('negative');
    }
    expect(new Set(labelled.map((p) => p.pairId)).size).toBe(30);
  });
});

describe('prompt', () => {
  it('renders every labelled card without any field of the key', () => {
    const byId = new Map(deck.cards.map((c) => [c.cardId, c]));
    for (const p of labelled) {
      for (const id of [p.originalCardId, p.damagedCardId]) {
        const card = byId.get(id);
        if (!card) throw new Error(`card missing ${id}`);
        const question = questions.questions[card.atomId];
        if (!question) throw new Error(`question missing ${card.atomId}`);
        const text = renderVerifierCard(card, question);
        expect(text).toContain('Question :');
        expect(text).not.toMatch(
          /member|citedFragment|pairId|positive|negative/u,
        );
      }
    }
    expect(VERIFIER_SYSTEM_PROMPT).toContain('« direct »');
  });

  it('marks the examined sentence and keeps blanks outside the marks', () => {
    const card = deck.cards.find((c) => /^S[123]_/u.test(c.stratum));
    if (!card) throw new Error('no single-span card');
    const text = renderVerifierCard(card, 'Q ?');
    expect(text).toContain('⟦');
    expect(text).toMatch(/⟧( |$|\n| …)/u);
    expect(text).not.toMatch(/⟦\s|\s⟧/u);
  });

  it('cuts a window at whole words, never inside one', () => {
    const windowed = deck.cards.filter(
      (c) => /^S[123]_/u.test(c.stratum) && c.window && c.window.start > 0,
    );
    expect(windowed.length).toBeGreaterThan(0);
    for (const card of windowed) {
      const text = renderVerifierCard(card, 'Q ?');
      const copy = text.slice(text.indexOf('Copie :\n') + 8);
      // After the leading ellipsis the first token is a whole word of the copy.
      const firstWord = /^…\s*(\S+)/u.exec(copy)?.[1];
      expect(firstWord).toBeDefined();
      expect(card.response.split(/\s+/u)).toContain(firstWord);
    }
  });
});

describe('answers', () => {
  it('parses a JSON verdict and refuses anything else', () => {
    expect(
      parseVerifierAnswer(
        '{"verdict":"partial","sentences":["s1"],"reason":"x"}',
      ),
    ).toEqual({ reason: 'x', sentences: ['s1'], verdict: 'partial' });
    expect(
      parseVerifierAnswer(
        'Voici : {"verdict":"direct","sentences":[],"reason":""}',
      )?.verdict,
    ).toBe('direct');
    expect(parseVerifierAnswer('{"verdict":"oui"}')).toBeNull();
    expect(parseVerifierAnswer('direct')).toBeNull();
  });

  it('takes a majority of two, never a plurality of one', () => {
    expect(majorityVerdict(['direct', 'direct', 'partial'])).toBe('direct');
    expect(majorityVerdict(['direct', 'partial', 'ambiguous'])).toBeNull();
    expect(majorityVerdict(['direct', null, null])).toBeNull();
    expect(majorityVerdict(['direct', 'direct', null])).toBe('direct');
  });

  it('ranks the original strictly above the damaged copy to win a pair', () => {
    expect(pairOutcome('direct', 'unsupported')).toBe('original');
    expect(pairOutcome('direct', 'ambiguous')).toBe('original');
    expect(pairOutcome('partial', 'partial')).toBe('tie');
    expect(pairOutcome('ambiguous', 'direct')).toBe('damaged');
    expect(pairOutcome(null, 'direct')).toBe('undecided');
  });
});

function synthetic(
  outcomes: { damaged: VerifierVerdict[]; original: VerifierVerdict[] }[],
): { observations: CardObservation[]; pairs: LabelledPair[] } {
  const pairsOut: LabelledPair[] = [];
  const observations: CardObservation[] = [];
  outcomes.forEach((o, i) => {
    const pairId = `p${i}`;
    pairsOut.push({
      atomId: 'x.a1',
      damagedCardId: `d${i}`,
      originalCardId: `o${i}`,
      pairId,
      stratum: 'S1_span_local',
    });
    o.original.forEach((v, r) =>
      observations.push({ cardId: `o${i}`, repetition: r + 1, verdict: v }),
    );
    o.damaged.forEach((v, r) =>
      observations.push({ cardId: `d${i}`, repetition: r + 1, verdict: v }),
    );
  });
  return { observations, pairs: pairsOut };
}

describe('readings', () => {
  const win = {
    damaged: ['unsupported', 'unsupported', 'unsupported'] as VerifierVerdict[],
    original: ['direct', 'direct', 'direct'] as VerifierVerdict[],
  };
  const lose = {
    damaged: ['direct', 'direct', 'direct'] as VerifierVerdict[],
    original: ['direct', 'direct', 'direct'] as VerifierVerdict[],
  };
  const flip = {
    damaged: ['unsupported', 'direct', 'unsupported'] as VerifierVerdict[],
    original: ['direct', 'direct', 'direct'] as VerifierVerdict[],
  };

  it('says proceed at 27 wins, both floors met, at most 2 flips', () => {
    const s = summariseModel({
      ...synthetic([...Array(28).fill(win), lose, lose]),
      repetitions: 3,
    });
    expect(s.pairs.original).toBe(28);
    expect(s.reading).toBe('proceed');
  });

  it('says narrow when pairs are won but the original is not accepted absolutely', () => {
    const partialWin = {
      damaged: [
        'unsupported',
        'unsupported',
        'unsupported',
      ] as VerifierVerdict[],
      original: ['partial', 'partial', 'partial'] as VerifierVerdict[],
    };
    const s = summariseModel({
      ...synthetic(Array(30).fill(partialWin)),
      repetitions: 3,
    });
    expect(s.pairs.original).toBe(30);
    expect(s.trueEvidenceAcceptance.accepted).toBe(0);
    expect(s.reading).toBe('narrow');
  });

  it('says stop below 24 wins or above 5 flips', () => {
    const s1 = summariseModel({
      ...synthetic([...Array(23).fill(win), ...Array(7).fill(lose)]),
      repetitions: 3,
    });
    expect(s1.reading).toBe('stop');
    const s2 = summariseModel({
      ...synthetic([...Array(24).fill(win), ...Array(6).fill(flip)]),
      repetitions: 3,
    });
    expect(s2.flips).toBe(6);
    expect(s2.reading).toBe('stop');
  });

  it('says indeterminate between the two', () => {
    const s = summariseModel({
      ...synthetic([...Array(25).fill(win), ...Array(5).fill(lose)]),
      repetitions: 3,
    });
    expect(s.reading).toBe('indeterminate');
  });

  it('compares majority verdicts to the owner pass 1 when given', () => {
    const data = synthetic([win, lose]);
    const pass1 = new Map<string, 'DIRECT' | 'NOT_DIRECT' | 'AMBIGUOUS'>([
      ['o0', 'DIRECT'],
      ['d0', 'DIRECT'],
      ['o1', 'DIRECT'],
    ]);
    const s = summariseModel({ ...data, pass1, repetitions: 3 });
    expect(s.absoluteAgainstPass1).toEqual({ agreements: 2, compared: 3 });
  });
});

describe('arithmetic', () => {
  it('reproduces the pass 2 tail probability', () => {
    expect(binomialUpperTail(33, 30)).toBeLessThan(1e-5);
    expect(binomialUpperTail(30, 27)).toBeLessThan(0.01);
    expect(binomialUpperTail(30, 20)).toBeGreaterThan(0.01);
  });

  it('estimates cost from token counts and shuffles deterministically', () => {
    expect(
      estimateCostUsd({
        completionTokensPerCall: 100,
        price: { completion: 0.00001, prompt: 0.000001 },
        promptTokens: [1000, 1000],
        repetitions: 3,
      }),
    ).toBeCloseTo(0.006 + 0.006, 6);
    const a = seededShuffle([1, 2, 3, 4, 5, 6], 'deadbeef');
    expect(seededShuffle([1, 2, 3, 4, 5, 6], 'deadbeef')).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
