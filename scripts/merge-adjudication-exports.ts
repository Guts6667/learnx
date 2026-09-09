/**
 * Merges pass-1 exports from several reviewers and measures agreement
 * (V4.5-210).
 *
 * Input: one or more export files as copied from the page. Output: per card,
 * every verdict with its reviewer, language and slice; raw agreement and
 * Cohen's kappa for every pair of reviewers over the cards they share; the
 * majority verdict where one exists; and the cards with no majority, which go
 * to pass 2. Nothing is decided here: a disagreement is reported, not settled.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Decision = {
  cardId: string;
  reviewerId: string;
  verdict: string;
  alternativeSupport: string | null;
  evidenceViewComplete: string | null;
  rationale: string;
  evidenceSentenceIds: string[];
};
type Export = {
  decisions: Decision[];
  deckHash: string;
  language?: string;
  sliceId?: string | null;
  questionsHash?: string | null;
};

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log(
    'usage: tsx scripts/merge-adjudication-exports.ts <export.json> [...]',
  );
  process.exit(1);
}
const exports_ = files.map((f) => ({
  file: f,
  ...(JSON.parse(readFileSync(path.resolve(f), 'utf8')) as Export),
}));
const deckHashes = new Set(exports_.map((e) => e.deckHash));
if (deckHashes.size > 1)
  throw new Error(
    `exports de paquets différents : ${[...deckHashes].join(', ')}`,
  );

type Vote = {
  file: string;
  language: string;
  reviewer: string;
  sliceId: string | null;
  verdict: string;
};
const byCard = new Map<string, Vote[]>();
const reviewers = new Set<string>();
for (const e of exports_) {
  for (const d of e.decisions) {
    const reviewer = d.reviewerId || path.basename(e.file);
    reviewers.add(reviewer);
    byCard.set(d.cardId, [
      ...(byCard.get(d.cardId) ?? []),
      {
        file: e.file,
        language: e.language ?? 'fr',
        reviewer,
        sliceId: e.sliceId ?? null,
        verdict: d.verdict,
      },
    ]);
  }
}

function kappa(a: string[], b: string[]): number | null {
  const n = a.length;
  if (n === 0) return null;
  const cats = [...new Set([...a, ...b])];
  let agree = 0;
  for (let i = 0; i < n; i += 1) if (a[i] === b[i]) agree += 1;
  const po = agree / n;
  let pe = 0;
  for (const c of cats)
    pe +=
      (a.filter((x) => x === c).length / n) *
      (b.filter((x) => x === c).length / n);
  return pe === 1 ? null : (po - pe) / (1 - pe);
}

const pairs: {
  a: string;
  b: string;
  kappa: number | null;
  raw: number;
  shared: number;
}[] = [];
const list = [...reviewers].sort();
for (let i = 0; i < list.length; i += 1) {
  for (let j = i + 1; j < list.length; j += 1) {
    const va: string[] = [];
    const vb: string[] = [];
    for (const votes of byCard.values()) {
      const x = votes.find((v) => v.reviewer === list[i]);
      const y = votes.find((v) => v.reviewer === list[j]);
      if (x && y) {
        va.push(x.verdict);
        vb.push(y.verdict);
      }
    }
    if (va.length === 0) continue;
    pairs.push({
      a: list[i] as string,
      b: list[j] as string,
      kappa: kappa(va, vb),
      raw: va.filter((v, k) => v === vb[k]).length / va.length,
      shared: va.length,
    });
  }
}

const majority: Record<string, { majority: string | null; votes: Vote[] }> = {};
let settled = 0;
let split = 0;
for (const [cardId, votes] of byCard) {
  const counts = new Map<string, number>();
  for (const v of votes)
    counts.set(v.verdict, (counts.get(v.verdict) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((x, y) => y[1] - x[1]);
  const top = sorted[0];
  const second = sorted[1];
  const maj =
    top && (!second || top[1] > second[1]) && top[1] * 2 > votes.length
      ? top[0]
      : null;
  majority[cardId] = { majority: maj, votes };
  if (maj) settled += 1;
  else split += 1;
}

const out = {
  agreementPairs: pairs,
  cards: majority,
  reviewers: list,
  summary: {
    cardsRated: byCard.size,
    noMajority: split,
    withMajority: settled,
  },
};
writeFileSync(
  path.resolve(
    'benchmarks/ai-correction/regression/adjudication-merge.latest.json',
  ),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(`relecteurs : ${list.join(', ')}`);
console.log(
  `cartes notées : ${byCard.size} · majorité : ${settled} · sans majorité (passe 2) : ${split}`,
);
for (const p of pairs)
  console.log(
    `  ${p.a} × ${p.b} : ${p.shared} cartes partagées, accord brut ${(p.raw * 100).toFixed(0)} %, kappa ${p.kappa === null ? '—' : p.kappa.toFixed(2)}`,
  );
