/**
 * Draws the pair slice for the second rater (V4.5-210, pass 2): the 7
 * primary pairs the owner left without a label (damaged member chosen, or a
 * tie) plus 8 primary pairs drawn by seed among the 30 he labelled. Fifteen
 * pairs, a quarter of an hour, and the agreement between two people is
 * computed on them.
 *
 * The key and the owner's export are read to know which pairs are which;
 * the file written carries pair ids only, never a member or a choice.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const SEED = 'v4.5-210/pair-slices/v1';
const DRAWN = 8;

type Pairs = {
  contentHash: string;
  pairs: { cards: string[]; pairId: string; primary: boolean }[];
};
type Key = { key: { cardId: string; member: string }[] };
type Pass2 = {
  decisions: {
    choice: string;
    leftCardId: string;
    pairId: string;
    rightCardId: string;
  }[];
};

const pairs = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-pairs.v1.json'), 'utf8'),
) as Pairs;
const key = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-deck.v3.key.json'), 'utf8'),
) as Key;
const pass2 = JSON.parse(
  readFileSync(
    path.resolve(REG, 'adjudication-pass2.owner.2026-09-05.json'),
    'utf8',
  ),
) as Pass2;
const member = new Map(key.key.map((k) => [k.cardId, k.member]));

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

const unlabeled: string[] = [];
const labeled: string[] = [];
for (const d of pass2.decisions) {
  const pair = pairs.pairs.find((p) => p.pairId === d.pairId);
  if (!pair || !pair.primary) continue;
  const chosen =
    d.choice === 'A' ? d.leftCardId : d.choice === 'B' ? d.rightCardId : null;
  if (chosen && member.get(chosen) === 'positive') labeled.push(d.pairId);
  else unlabeled.push(d.pairId);
}
if (unlabeled.length !== 7 || labeled.length !== 30) {
  throw new Error(
    `PAIR_SLICE_COUNTS_UNEXPECTED ${unlabeled.length}/${labeled.length}`,
  );
}
for (let i = labeled.length - 1; i > 0; i -= 1) {
  const j = Math.floor(random() * (i + 1));
  const a = labeled[i];
  const b = labeled[j];
  if (a && b) {
    labeled[i] = b;
    labeled[j] = a;
  }
}
const chosen = [...unlabeled, ...labeled.slice(0, DRAWN)];
// Pair-file order, so the second rater's rail follows the same sequence.
const order = new Map(pairs.pairs.map((p, i) => [p.pairId, i]));
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
  pairsHash: pairs.contentHash,
  purpose: 'second-rater',
  schemaVersion: 1,
  seed: SEED,
  slices: [{ pairIds: chosen, purpose: 'second-rater', sliceId: 'P-01' }],
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
if (/"member"|positive|negative|choice|unlabeled/u.test(text)) {
  throw new Error('PAIR_SLICE_FILE_CARRIES_KEY_MATERIAL');
}
const out = path.resolve(REG, 'adjudication-pair-slices.v1.json');
writeFileSync(out, text + '\n');
console.log(`tranche de paires écrite : ${out}`);
console.log(`paires : ${chosen.length} (7 sans étiquette + ${DRAWN} tirées)`);
