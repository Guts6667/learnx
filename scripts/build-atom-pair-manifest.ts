/**
 * Builds the randomized pair-adjudication manifest (V4.5-210).
 *
 * Reads only artefacts already bought and the locked atom taxonomy. Emits
 * candidate pairs for human adjudication — it decides nothing itself.
 *
 * A pair is: one atom, one NEGATIVE span (what a grader cited when it wrongly
 * awarded top) and one POSITIVE span (the genuine carrier from the undamaged
 * original). Pair members are shown to a verifier independently; they are paired
 * only at analysis.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  loadRegressionSource,
  parseRegressionPool,
} from '../src/lib/ai-correction-regression-pool.ts';
import { planRegressionRun } from '../src/lib/ai-correction-regression-run.ts';

const REG = 'benchmarks/ai-correction/regression';
const POOL = path.resolve(REG, 'regression-pool.v1.json');
const TAXONOMY = path.resolve(REG, 'criterion-atoms.v3_2_2.json');

/**
 * The runs the review basis was computed on, declared rather than inferred.
 *
 * Scanning every results directory yields 20 failures over 18 clusters; these
 * four yield exactly the 18 over 16 the statistical bound assumes. The two
 * extras come from runs predating prompt 2.3.0 — a different system — and one
 * of them names `residual-risk-coverage`, a criterion the taxonomy never
 * atomised. Mixing them would silently change the population the 82.9 % bound
 * was computed for.
 */
const RUN_SCOPE = new Set([
  '2026-08-31T16-42-09-070Z',
  '2026-08-31T21-12-58-892Z',
  '2026-09-01T14-13-17-639Z',
  '2026-09-01T15-38-20-436Z',
]);

type Atom = { atomId: string; atom: string; stratum: string; evaluator: string };
type Taxonomy = {
  contentHash: string;
  criteria: Record<string, { inPrimaryEndpoint: boolean; atoms: Atom[] }>;
};

function sha(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(value, Object.keys(value as object).sort()))
    .digest('hex')}`;
}

function main(): void {
  const taxonomy = JSON.parse(readFileSync(TAXONOMY, 'utf8')) as Taxonomy;
  const pool = parseRegressionPool(
    JSON.parse(readFileSync(POOL, 'utf8')) as unknown,
  );
  const sources = new Map(
    pool.sources.map((source) => [
      source.path,
      loadRegressionSource(
        readFileSync(path.resolve(path.dirname(POOL), source.path)),
      ),
    ]),
  );
  const plan = planRegressionRun({ pool, sources });

  // Every violation observed across every paid run, with the span each grader
  // chose. Runs are provenance, never extra cases.
  type FailureMode = 'ABSENT' | 'AVEC_CITATION' | 'ILLISIBLE' | 'SANS_CITATION';
  type Observed = {
    criterionKey: string;
    mode: FailureMode;
    mutantId: string;
    runs: string[];
    spans: string[];
  };
  const observed = new Map<string, Observed>();
  const resultsDir = path.resolve(REG, 'results');
  const excludedRuns: { reason: string; run: string }[] = [];
  for (const run of readdirSync(resultsDir)) {
    if (!RUN_SCOPE.has(run)) {
      excludedRuns.push({ reason: 'hors base de revue', run });
      continue;
    }
    const base = path.join(resultsDir, run);
    let summary: unknown;
    try {
      summary = JSON.parse(readFileSync(path.join(base, 'summary.json'), 'utf8'));
    } catch {
      continue;
    }
    const details = findDetails(summary);
    if (details.length === 0) continue;
    const attempts = JSON.parse(
      readFileSync(path.join(base, 'attempts.json'), 'utf8'),
    ) as { caseId: string; output?: { criteria: { criterionKey: string; evidenceQuotes?: string[] }[] } }[];

    for (const detail of details) {
      const key = `${detail.mutantId}::${detail.criterionKey}`;
      const unit = [...plan.unitsByBenchmarkCaseId.values()].find(
        (candidate) => candidate.mutantId === detail.mutantId,
      );
      const spans = attempts
        .filter((attempt) => attempt.caseId === unit?.benchmarkCaseId)
        .flatMap((attempt) =>
          (attempt.output?.criteria ?? [])
            .filter((c) => c.criterionKey === detail.criterionKey)
            .flatMap((c) => c.evidenceQuotes ?? []),
        );
      const entry = observed.get(key) ?? {
        criterionKey: detail.criterionKey,
        mode: 'ILLISIBLE' as FailureMode,
        mutantId: detail.mutantId,
        runs: [],
        spans: [],
      };
      entry.runs.push(run);
      for (const span of spans) if (!entry.spans.includes(span)) entry.spans.push(span);

      // What the grader actually emitted decides whether a verifier can be
      // asked anything at all. A criterion absent from the output, or awarded
      // top with no quote, has no span to judge — code catches those, not a
      // model.
      const emitted = attempts
        .filter((attempt) => attempt.caseId === unit?.benchmarkCaseId)
        .map((attempt) =>
          (attempt.output?.criteria ?? []).find(
            (c) => c.criterionKey === detail.criterionKey,
          ),
        );
      let mode: FailureMode = entry.mode;
      if (entry.spans.length > 0) mode = 'AVEC_CITATION';
      else if (emitted.some((c) => c !== undefined)) mode = 'SANS_CITATION';
      else if (emitted.length > 0) mode = 'ABSENT';
      entry.mode = mode;
      observed.set(key, entry);
    }
  }

  // Candidate pairs, one per (observed failure × atom of that criterion).
  const pairs: unknown[] = [];
  const untestable: { criterionKey: string; mode: string; mutantId: string; rule: string }[] = [];
  for (const entry of observed.values()) {
    const criterion = taxonomy.criteria[entry.criterionKey];
    if (!criterion) continue;
    if (entry.mode !== 'AVEC_CITATION') {
      untestable.push({
        criterionKey: entry.criterionKey,
        mode: entry.mode,
        mutantId: entry.mutantId,
        rule:
          entry.mode === 'ABSENT'
            ? "critère absent de la sortie : un critère non rendu ne peut pas être noté"
            : "niveau haut sans aucune citation : le haut exige au moins une citation résolue",
      });
      continue;
    }
    const poolCaseId = entry.mutantId.split('#')[0] ?? '';
    const baseline = [...plan.unitsByBenchmarkCaseId.values()].find(
      (unit) => unit.poolCaseId === poolCaseId && unit.mutantId === undefined,
    );
    for (const atom of criterion.atoms) {
      if (atom.evaluator !== 'verifier') continue;
      pairs.push({
        atomId: atom.atomId,
        atomText: atom.atom,
        authoredAnswerId: poolCaseId,
        criterionKey: entry.criterionKey,
        inPrimaryEndpoint: criterion.inPrimaryEndpoint,
        mutantId: entry.mutantId,
        negativeSpans: entry.spans,
        originalTextSha: baseline
          ? `sha256:${createHash('sha256').update(baseline.responseText).digest('hex').slice(0, 16)}`
          : null,
        // Adjudication fields — deliberately empty. A human fills them.
        adjudication: {
          negativeVerdictGold: null,
          positiveSpan: null,
          positiveVerdictGold: null,
          status: 'PENDING',
        },
        provenance: { observedInRuns: entry.runs.sort() },
        stratum: atom.stratum,
      });
    }
  }

  const manifest = {
    aggregation:
      "Macro-moyenne par réponse rédigée (authoredAnswerId), jamais par critère ni par atome. Les répétitions mesurent l'instabilité de l'API et ne sont pas des échantillons indépendants.",
    atomTaxonomyHash: taxonomy.contentHash,
    deterministicallyCatchable: {
      failures: untestable.sort((a, b) => a.mutantId.localeCompare(b.mutantId)),
      note:
        "Ces échecs ne posent aucune question à un vérificateur : il n'y a rien à vérifier. Ils relèvent d'une règle déterministe, sans appel de modèle. Ils restent des échecs réels et comptent dans la population de 18.",
    },
    normalisationTables: {
      numeric: JSON.parse(
        readFileSync(path.resolve(REG, 'normalisation/numeric.v1.json'), 'utf8'),
      ).contentHash as string,
      unit: JSON.parse(
        readFileSync(path.resolve(REG, 'normalisation/unit.v1.json'), 'utf8'),
      ).contentHash as string,
    },
    pairs,
    poolSha256: `sha256:${createHash('sha256').update(readFileSync(POOL)).digest('hex')}`,
    runScope: {
      excludedRuns: excludedRuns.filter((entry) =>
        readdirSync(path.join(resultsDir, entry.run)).includes('summary.json'),
      ),
      includedRuns: [...RUN_SCOPE].sort(),
      rationale:
        'Ces quatre runs produisent exactement les 18 échecs sur 16 grappes que la borne statistique suppose. Les autres précèdent la consigne 2.3.0 ou nomment un critère non atomisé. Sur ces 18, 16 (14 grappes) citent un span et sont testables par un vérificateur.',
    },
    marginalRates:
      "Rapportés séparément et toujours ensemble : hard_negative_rejection, true_evidence_acceptance, taux d'ambiguïté. Aucun n'est fondu dans l'endpoint apparié.",
    pairSuccess:
      "Succès de paire = positif DIRECT ET négatif apparié REJETÉ. Un AMBIGUOUS d'un côté ou de l'autre annule le crédit primaire et la paire est comptée dans la strate d'ambiguïté. Les deux membres sont soumis INDÉPENDAMMENT au vérificateur ; l'appariement n'existe qu'à l'analyse.",
    schemaVersion: 2,
    status: 'PENDING_ADJUDICATION — aucun appel fournisseur autorisé avant adjudication complète.',
    // Machine-readable in v2. v1 carried prose only, which code cannot apply
    // without guessing.
    verdictMapping: {
      AMBIGUOUS: {
        decision: 'ABSTAIN',
        note: "aucun crédit de discrimination primaire, rapporté en strate distincte",
      },
      CONTRADICTED: { decision: 'REJECT', note: 'rejet sémantique' },
      DIRECT: { decision: 'ACCEPT', note: 'seul verdict qui autorise le niveau TOP' },
      PARTIAL: { decision: 'REJECT', note: 'rejet sémantique' },
      UNSUPPORTED: { decision: 'REJECT', note: 'rejet sémantique' },
    },
    supersedes: {
      contentHash:
        'sha256:3593b4e607523fccc3ea41827586703bd9d89cd9d07b051e13e8ca6f2de0d67d',
      file: 'atom-pair-manifest.v1.json',
      reason:
        "v1 traitait les 18 échecs comme testables par un vérificateur. Deux ne le sont pas : l'un ne rend pas le critère, l'autre attribue le haut sans citation. La population du vérificateur est donc de 16 échecs sur 14 grappes, et v1 comptait 7 paires sans span négatif.",
    },
  };
  writeFileSync(
    path.resolve(REG, 'atom-pair-manifest.v2.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const byStratum = new Map<string, number>();
  for (const pair of pairs as { stratum: string }[]) {
    byStratum.set(pair.stratum, (byStratum.get(pair.stratum) ?? 0) + 1);
  }
  const clusters = new Set(
    (pairs as { authoredAnswerId: string }[]).map((p) => p.authoredAnswerId),
  );
  console.log(`échecs observés distincts : ${observed.size}`);
  console.log(`   dont testables par vérificateur : ${observed.size - untestable.length}`);
  console.log(`   dont règle déterministe         : ${untestable.length}`);
  console.log(`paires candidates          : ${pairs.length}`);
  console.log(`grappes (réponses rédigées): ${clusters.size}`);
  for (const [stratum, count] of [...byStratum].sort()) {
    console.log(`   ${stratum.padEnd(20)} ${count}`);
  }
  console.log(`hash taxonomie : ${taxonomy.contentHash}`);
  void sha;
}

function findDetails(
  value: unknown,
): { criterionKey: string; mutantId: string }[] {
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.mutationDirectionViolationDetails)) {
    return record.mutationDirectionViolationDetails as {
      criterionKey: string;
      mutantId: string;
    }[];
  }
  for (const nested of Object.values(record)) {
    const found = findDetails(nested);
    if (found.length > 0) return found;
  }
  return [];
}

main();
