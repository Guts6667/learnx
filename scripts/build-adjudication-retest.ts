/**
 * Draws the test-retest slice for pass 1 (V4.5-210): 10 primary cards the
 * owner will judge a second time, two days after the first pass, without
 * seeing the first answers.
 *
 * Excluded by construction: the 10 cards of the paste pack's first batch (the
 * owner learned which member they are while reading the model runs), and a
 * second card of a pair already drawn. The key is read only to know which
 * cards are primary and which pair they belong to; nothing of it is written.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const SEED = 'v4.5-210/retest/v1';
const SIZE = 10;

type Deck = { cards: { cardId: string }[]; manifestHash: string };
type Key = {
  key: { cardId: string; inPrimaryEndpoint: boolean; pairId: string }[];
};
type Manifest = { batches: { cardIds: string[] }[] };

const deck = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-deck.v3.json'), 'utf8'),
) as Deck;
const key = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-deck.v3.key.json'), 'utf8'),
) as Key;
const pack = JSON.parse(
  readFileSync(path.resolve(REG, 'paste-pack.v1/manifest.json'), 'utf8'),
) as Manifest;
const learned = new Set(pack.batches[0]?.cardIds ?? []);

function rng(seed: string): () => number {
  const h = createHash('sha256').update(seed).digest();
  let a = h.readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(SEED);

const candidates = key.key
  .filter((k) => k.inPrimaryEndpoint && !learned.has(k.cardId))
  .map((k) => ({ cardId: k.cardId, pairId: k.pairId }));
for (let i = candidates.length - 1; i > 0; i -= 1) {
  const j = Math.floor(random() * (i + 1));
  const a = candidates[i];
  const b = candidates[j];
  if (a && b) {
    candidates[i] = b;
    candidates[j] = a;
  }
}
const chosen: string[] = [];
const pairsUsed = new Set<string>();
for (const c of candidates) {
  if (chosen.length === SIZE) break;
  if (pairsUsed.has(c.pairId)) continue;
  pairsUsed.add(c.pairId);
  chosen.push(c.cardId);
}
if (chosen.length !== SIZE) throw new Error('RETEST_DRAW_INCOMPLETE');
// Deck order for the page, so the rail reads like the main pass.
const order = new Map(deck.cards.map((c, i) => [c.cardId, i]));
chosen.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

const canon = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v as Record<string, unknown>)
            .sort()
            .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
        )
      : v;
const body = {
  deckHash: deck.manifestHash,
  excludedCardIds: [...learned].sort(),
  purpose: 'test-retest',
  schemaVersion: 1,
  seed: SEED,
  slices: [{ cards: chosen, purpose: 'test-retest', sliceId: 'R-01' }],
  status: 'sealed',
};
const text = JSON.stringify(
  {
    ...body,
    contentHash:
      'sha256:' +
      createHash('sha256')
        .update(JSON.stringify(canon(body)))
        .digest('hex'),
  },
  null,
  2,
);
if (/"member"|inPrimaryEndpoint|pairId|citedFragment/u.test(text)) {
  throw new Error('RETEST_FILE_CARRIES_KEY_MATERIAL');
}
const out = path.resolve(REG, 'adjudication-retest.v1.json');
writeFileSync(out, text + '\n');
console.log(`relecture écrite : ${out}`);
console.log(`cartes           : ${chosen.join(' ')}`);
