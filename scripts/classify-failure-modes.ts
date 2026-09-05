/**
 * Classifies every observed failure in the review basis by what the grader
 * actually emitted (V4.5-210). The verifier experiment can only test failures
 * where a span was cited; the others need code, not a model.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  loadRegressionSource,
  parseRegressionPool,
} from '../src/lib/ai-correction-regression-pool.ts';
import { planRegressionRun } from '../src/lib/ai-correction-regression-run.ts';

const REG = 'benchmarks/ai-correction/regression';
const POOL = path.resolve(REG, 'regression-pool.v1.json');
const RUNS = [
  '2026-08-31T16-42-09-070Z',
  '2026-08-31T21-12-58-892Z',
  '2026-09-01T14-13-17-639Z',
  '2026-09-01T15-38-20-436Z',
];

function walk(node: unknown): { criterionKey: string; mutantId: string }[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if (
      typeof rec.mutantId === 'string' &&
      typeof rec.criterionKey === 'string'
    ) {
      return [{ criterionKey: rec.criterionKey, mutantId: rec.mutantId }];
    }
    return Object.values(rec).flatMap(walk);
  }
  return [];
}

const pool = parseRegressionPool(
  JSON.parse(readFileSync(POOL, 'utf8')) as unknown,
);
const sources = new Map(
  pool.sources.map((s) => [
    s.path,
    loadRegressionSource(
      readFileSync(path.resolve(path.dirname(POOL), s.path)),
    ),
  ]),
);
const plan = planRegressionRun({ pool, sources });

type Mode = 'ABSENT' | 'ILLISIBLE' | 'SANS_CITATION' | 'AVEC_CITATION';
const byFailure = new Map<
  string,
  { criterionKey: string; mode: Mode; mutantId: string }
>();

for (const run of RUNS) {
  const base = path.join(path.resolve(REG, 'results'), run);
  let summary: unknown;
  try {
    summary = JSON.parse(readFileSync(path.join(base, 'summary.json'), 'utf8'));
  } catch {
    continue;
  }
  const attempts = JSON.parse(
    readFileSync(path.join(base, 'attempts.json'), 'utf8'),
  ) as {
    caseId: string;
    output?: {
      criteria: { criterionKey: string; evidenceQuotes?: string[] }[];
    };
  }[];

  for (const detail of walk(summary)) {
    const key = `${detail.mutantId}::${detail.criterionKey}`;
    const unit = [...plan.unitsByBenchmarkCaseId.values()].find(
      (candidate) => candidate.mutantId === detail.mutantId,
    );
    const mine = attempts.filter((a) => a.caseId === unit?.benchmarkCaseId);
    let mode: Mode = 'ILLISIBLE';
    for (const attempt of mine) {
      const criteria = attempt.output?.criteria ?? [];
      const hit = criteria.find((c) => c.criterionKey === detail.criterionKey);
      if (!hit) {
        if (mode === 'ILLISIBLE') mode = 'ABSENT';
        continue;
      }
      if ((hit.evidenceQuotes ?? []).length > 0) mode = 'AVEC_CITATION';
      else if (mode !== 'AVEC_CITATION') mode = 'SANS_CITATION';
    }
    const prior = byFailure.get(key);
    // A failure counts as testable if any run cited a span for it.
    if (
      !prior ||
      (prior.mode !== 'AVEC_CITATION' && mode === 'AVEC_CITATION')
    ) {
      byFailure.set(key, {
        criterionKey: detail.criterionKey,
        mode,
        mutantId: detail.mutantId,
      });
    }
  }
}

const counts = new Map<Mode, number>();
for (const f of byFailure.values())
  counts.set(f.mode, (counts.get(f.mode) ?? 0) + 1);
const clusters = new Map<Mode, Set<string>>();
for (const f of byFailure.values()) {
  const c = clusters.get(f.mode) ?? new Set<string>();
  c.add(f.mutantId.split('#')[0] ?? '');
  clusters.set(f.mode, c);
}

console.log(`échecs observés (base de revue) : ${byFailure.size}`);
for (const mode of [
  'AVEC_CITATION',
  'SANS_CITATION',
  'ABSENT',
  'ILLISIBLE',
] as Mode[]) {
  const n = counts.get(mode) ?? 0;
  if (n === 0) continue;
  console.log(
    `  ${mode.padEnd(15)} ${String(n).padStart(2)} échecs, ${clusters.get(mode)?.size ?? 0} grappes`,
  );
}
console.log('\ndétail des échecs non testables par un vérificateur :');
for (const f of byFailure.values()) {
  if (f.mode === 'AVEC_CITATION') continue;
  console.log(
    `  ${f.mode.padEnd(15)} ${f.criterionKey.padEnd(24)} ${f.mutantId.split('/').pop()?.slice(0, 70)}`,
  );
}
