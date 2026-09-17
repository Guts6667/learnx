/**
 * Builds the pair file for pass 2 (V4.5-210): the 45 positive/negative pairs
 * of deck v3, as two card ids side by side, with every trace of which member
 * is which removed.
 *
 * Pass 2 is a forced choice: the reviewer sees both copies of a pair and says
 * which one better establishes the requirement. The page must not know the
 * answer, so this file carries no `member`, and the left/right position of
 * the original is drawn from a seeded shuffle. The build prints how often the
 * original sits on the left, as a blinding check, and nothing per pair.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const SEED = 'v4.5-210/adjudication-pairs/v1';

type Deck = {
  cards: { atomId: string; cardId: string; stratum: string }[];
  manifestHash: string;
};
type Key = {
  contentHash: string;
  key: {
    cardId: string;
    inPrimaryEndpoint: boolean;
    member: string;
    pairId: string;
  }[];
};

const deck = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-deck.v3.json'), 'utf8'),
) as Deck;
const key = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-deck.v3.key.json'), 'utf8'),
) as Key;
const cards = new Map(deck.cards.map((c) => [c.cardId, c]));

/** mulberry32 seeded from the sha256 of a string: small, deterministic. */
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

const byPair = new Map<string, Key['key']>();
for (const entry of key.key) {
  if (entry.member !== 'positive' && entry.member !== 'negative') continue;
  byPair.set(entry.pairId, [...(byPair.get(entry.pairId) ?? []), entry]);
}
let originalLeft = 0;
const pairs = [...byPair.entries()].map(([pairId, members]) => {
  if (members.length !== 2) {
    throw new Error(`PAIR_WITHOUT_TWO_MEMBERS ${pairId}`);
  }
  const positive = members.find((m) => m.member === 'positive');
  const negative = members.find((m) => m.member === 'negative');
  if (!positive || !negative) throw new Error(`PAIR_INCOMPLETE ${pairId}`);
  const cp = cards.get(positive.cardId);
  const cn = cards.get(negative.cardId);
  if (!cp || !cn) throw new Error(`PAIR_CARD_MISSING ${pairId}`);
  if (cp.atomId !== cn.atomId || cp.stratum !== cn.stratum) {
    throw new Error(`PAIR_MEMBERS_DIFFER ${pairId}`);
  }
  const positiveLeft = random() < 0.5;
  if (positiveLeft) originalLeft += 1;
  return {
    atomId: cp.atomId,
    cards: positiveLeft
      ? [positive.cardId, negative.cardId]
      : [negative.cardId, positive.cardId],
    pairId,
    primary: positive.inPrimaryEndpoint,
    stratum: cp.stratum,
  };
});
// Pair order: a second seeded shuffle, so deck order leaks nothing either.
for (let i = pairs.length - 1; i > 0; i -= 1) {
  const j = Math.floor(random() * (i + 1));
  const a = pairs[i];
  const b = pairs[j];
  if (a && b) {
    pairs[i] = b;
    pairs[j] = a;
  }
}

const body = {
  deckHash: deck.manifestHash,
  keyHash: key.contentHash,
  pairs,
  schemaVersion: 1,
  seed: SEED,
  status: 'sealed',
};
/** Same recipe as seal-benchmark-artifact.py: keys sorted at every level, compact. */
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
const canonical = JSON.stringify(canon(body));
const text = JSON.stringify(
  {
    ...body,
    contentHash:
      'sha256:' + createHash('sha256').update(canonical).digest('hex'),
  },
  null,
  2,
);
if (/"member"|control_positive|citedFragment|responseHash/u.test(text)) {
  throw new Error('PAIRS_FILE_CARRIES_KEY_MATERIAL');
}
const out = path.resolve(REG, 'adjudication-pairs.v1.json');
writeFileSync(out, text + '\n');
console.log(`paires écrites : ${out}`);
console.log(
  `paires         : ${pairs.length} (${pairs.filter((p) => p.primary).length} primaires)`,
);
console.log(
  `original à gauche : ${originalLeft}/${pairs.length} (contrôle d'aveuglement, jamais par paire)`,
);
