/**
 * Builds the volunteer slices (V4.5-210).
 *
 * Volunteers will do eight cards, not 106. Each slice is drawn from the 50
 * cards of the 25 primary pairs, fixed in advance, and never holds two cards
 * of the same pair, the same response text or the same authored answer — in
 * an eight-card slice any of those would be a tell. Two coverings, so every
 * primary card can be rated by two volunteers besides the owner.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const SEED = 'v4.5-210/slices/v1';
const SLICE_SIZE = 8;
const COVERINGS = 2;

type KeyEntry = {
  cardId: string;
  clusterId: string;
  inPrimaryEndpoint: boolean;
  lengthDiagnostic?: boolean;
  member: string;
  pairId: string | null;
  responseHash: string;
};

function rng(seed: string): () => number {
  let state = parseInt(
    createHash('sha256').update(seed).digest('hex').slice(0, 8),
    16,
  );
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (
  JSON.parse(
    readFileSync(path.resolve(REG, 'adjudication-deck.v3.key.json'), 'utf8'),
  ) as {
    key: KeyEntry[];
  }
).key;
const deck = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-deck.v3.json'), 'utf8'),
) as {
  cards: { cardId: string }[];
  contentHash: string;
};
const order = new Map(deck.cards.map((c, i) => [c.cardId, i]));

// The 50 cards of the 25 clean primary pairs.
const byPair = new Map<string, KeyEntry[]>();
for (const e of key)
  if (e.pairId) byPair.set(e.pairId, [...(byPair.get(e.pairId) ?? []), e]);
const primary = [...byPair.values()]
  .filter(
    (m) =>
      m.length === 2 &&
      m.every((e) => e.inPrimaryEndpoint && !e.lengthDiagnostic),
  )
  .flat();

const conflicts = (a: KeyEntry, b: KeyEntry): boolean =>
  a.pairId === b.pairId ||
  a.responseHash === b.responseHash ||
  a.clusterId === b.clusterId;

const slices: { cards: string[]; covering: number; sliceId: string }[] = [];
for (let covering = 1; covering <= COVERINGS; covering += 1) {
  // First-fit into a fixed number of slices, over many shuffles; keep the
  // shuffle whose slices are the most even. Greedy filling left slices of one
  // or two cards: the last cards conflicted with everything already placed.
  const target = Math.ceil(primary.length / SLICE_SIZE);
  let best: KeyEntry[][] | null = null;
  let bestSpread = Infinity;
  for (let trial = 0; trial < 400; trial += 1) {
    const next = rng(`${SEED}/${covering}/${trial}`);
    const pool = [...primary];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [pool[i], pool[j]] = [pool[j] as KeyEntry, pool[i] as KeyEntry];
    }
    const bins: KeyEntry[][] = Array.from({ length: target }, () => []);
    let placed = 0;
    for (const card of pool) {
      // Smallest compatible bin first, so sizes stay even.
      const candidates = bins
        .map((bin, index) => ({ bin, index }))
        .filter(
          ({ bin }) =>
            bin.length < SLICE_SIZE && bin.every((s) => !conflicts(s, card)),
        )
        .sort((a, b) => a.bin.length - b.bin.length);
      const slot = candidates[0];
      if (!slot) continue;
      slot.bin.push(card);
      placed += 1;
    }
    if (placed !== primary.length) continue;
    const sizes = bins.map((b) => b.length);
    const spread = Math.max(...sizes) - Math.min(...sizes);
    if (spread < bestSpread) {
      bestSpread = spread;
      best = bins.map((b) => [...b]);
      if (spread <= 1) break;
    }
  }
  if (!best)
    throw new Error(
      `couverture ${covering} : aucun tirage ne place les ${primary.length} cartes en ${target} tranches`,
    );
  best.forEach((bin, index) => {
    bin.sort((a, b) => (order.get(a.cardId) ?? 0) - (order.get(b.cardId) ?? 0));
    slices.push({
      cards: bin.map((e) => e.cardId),
      covering,
      sliceId: `${covering}-${String(index + 1).padStart(2, '0')}`,
    });
  });
}

const out = {
  coverings: COVERINGS,
  deckHash: deck.contentHash,
  primaryCards: primary.length,
  rule: 'Une tranche ne contient jamais deux cartes de la même paire, de la même réponse ni de la même copie. Chaque carte primaire figure dans une tranche par couverture.',
  schemaVersion: 1,
  seed: SEED,
  sliceSize: SLICE_SIZE,
  slices,
};
writeFileSync(
  path.resolve(REG, 'adjudication-slices.v1.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(`cartes primaires : ${primary.length}`);
console.log(
  `tranches : ${slices.length} (${slices.map((s) => s.cards.length).join(', ')})`,
);
// Sanity: every primary card appears exactly COVERINGS times.
const count = new Map<string, number>();
for (const s of slices)
  for (const c of s.cards) count.set(c, (count.get(c) ?? 0) + 1);
console.log(
  `cartes vues ${COVERINGS} fois : ${[...count.values()].filter((n) => n === COVERINGS).length} / ${primary.length}`,
);
