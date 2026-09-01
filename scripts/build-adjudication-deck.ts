/**
 * Builds the blind adjudication deck (V4.5-210, pass 1).
 *
 * 90 independent cards — one per pair member — in a seeded random order, with
 * the two members of a pair never adjacent and never within MIN_GAP of each
 * other. A card carries the atom, its predicate and witness roles, one
 * candidate span, and the full response with that span located. It carries
 * NOTHING that identifies which member it is: no model, no prior verdict, no
 * mutation kind, no expected level, no partner id.
 *
 * The positive candidate is recovered from the mutation hint, not invented:
 * for SENTENCE_DELETION it is the authored sentence the mutant removed, for
 * FACT_INVERSION the authored sentence the mutant altered. That sentence is the
 * carrier the rubric was written against.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  loadRegressionSource,
  parseRegressionPool,
} from '../src/lib/ai-correction-regression-pool.ts';
import { planRegressionRun } from '../src/lib/ai-correction-regression-run.ts';
import { segmentSentences } from '../src/lib/ai-correction-regression-text.ts';

const REG = 'benchmarks/ai-correction/regression';
const POOL = path.resolve(REG, 'regression-pool.v1.json');
const TAXONOMY = path.resolve(REG, 'criterion-atoms.v3_2_2.json');
const MANIFEST = path.resolve(REG, 'atom-pair-manifest.v2.json');
const OUT = path.resolve(REG, 'adjudication-deck.v1.json');

/** Recorded so the order is reproducible and was not chosen after seeing it. */
const SHUFFLE_SEED = 'v4.5-210/adjudication-deck/pass-1';
/** Minimum number of cards between the two members of one pair. */
const MIN_GAP = 8;

/** External grounding a card may show, decided by the stratum alone. */
const STRATUM_GROUNDING: Record<string, ('dossier' | 'frame')[]> = {
  S1_span_local: [],
  S2_span_frame: ['frame'],
  S3_span_dossier: ['frame', 'dossier'],
  S4_multi_local: [],
  S5_multi_frame: ['frame'],
  S6_multi_dossier: ['frame', 'dossier'],
  S7_full_dossier: ['frame', 'dossier'],
};

type Atom = {
  arguments: string[];
  atom: string;
  atomId: string;
  logicalOperator: string;
  predicate: string;
  quantifier: string;
  responseArity: number;
  sourcePhrase: string;
  stratum: string;
};
type Criterion = {
  atoms: Atom[];
  inPrimaryEndpoint: boolean;
  label: string;
  witnessGroupId: string;
  witnessRoles: string[];
};

/** Mulberry32 over a hashed seed — deterministic across machines. */
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

function shuffled<T>(items: T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function main(): void {
  const taxonomy = JSON.parse(readFileSync(TAXONOMY, 'utf8')) as {
    contentHash: string;
    criteria: Record<string, Criterion>;
  };
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    contentHash: string;
    pairs: {
      atomId: string;
      authoredAnswerId: string;
      criterionKey: string;
      inPrimaryEndpoint: boolean;
      mutantId: string;
      negativeSpans: string[];
      stratum: string;
    }[];
  };
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

  // Task frame and dossier, straight from the authored corpus.
  const frames = new Map<string, { dossier: string; frame: string }>();
  for (const poolCase of pool.cases) {
    const source = sources.get(poolCase.sourcePath);
    const sourceCase = source?.corpus.cases.find(
      (c) => c.caseId === poolCase.sourceCaseId,
    ) as { taskContext?: string; taskPrompt?: string } | undefined;
    frames.set(poolCase.caseId, {
      dossier: sourceCase?.taskContext ?? '',
      frame: sourceCase?.taskPrompt ?? '',
    });
  }

  type Card = {
    atom: string;
    atomId: string;
    candidateSpan: string;
    cardId: string;
    criterionLabel: string;
    dossier?: string;
    frame?: string;
    highlight: { end: number; start: number } | null;
    logicalOperator: string;
    predicate: string;
    quantifier: string;
    response: string;
    responseArity: number;
    sourcePhrase: string;
    stratum: string;
    witnessGroupId: string;
    witnessRoles: string[];
  };
  // The answer key. Never merged into a card, never exported to the reviewer.
  type Key = {
    cardId: string;
    member: 'negative' | 'positive';
    pairId: string;
  };

  const cards: Card[] = [];
  const key: Key[] = [];
  const skipped: { pairId: string; reason: string }[] = [];

  for (const pair of manifest.pairs) {
    const criterion = taxonomy.criteria[pair.criterionKey];
    const atom = criterion?.atoms.find((a) => a.atomId === pair.atomId);
    const pairId = createHash('sha256')
      .update(`${pair.mutantId}::${pair.atomId}`)
      .digest('hex')
      .slice(0, 16);
    if (!criterion || !atom) {
      skipped.push({ pairId, reason: 'atome introuvable' });
      continue;
    }

    const poolCase = pool.cases.find((c) => c.caseId === pair.authoredAnswerId);
    const baseline = [...plan.unitsByBenchmarkCaseId.values()].find(
      (unit) =>
        unit.poolCaseId === pair.authoredAnswerId &&
        unit.mutantId === undefined,
    );
    const mutant = [...plan.unitsByBenchmarkCaseId.values()].find(
      (unit) => unit.mutantId === pair.mutantId,
    );
    if (!poolCase || !baseline || !mutant) {
      skipped.push({ pairId, reason: 'texte de base ou mutant introuvable' });
      continue;
    }

    // The authored carrier: the sentence the mutation removed or altered.
    const kind = pair.mutantId.split('#')[1] ?? '';
    let positiveSpan: string | null = null;
    if (kind === 'SENTENCE_DELETION') {
      const index = Number.parseInt(pair.mutantId.split('@').pop() ?? '', 10);
      const sentences = segmentSentences({
        locale: 'fr',
        text: baseline.responseText,
      });
      const sentence = sentences[index];
      if (sentence)
        positiveSpan = baseline.responseText
          .slice(sentence.start, sentence.end)
          .trim();
    } else if (kind === 'FACT_INVERSION') {
      const hint = poolCase.mutationHints.find(
        (h) =>
          h.kind === 'FACT_INVERSION' && h.criterionKey === pair.criterionKey,
      ) as { replace: { from: string } } | undefined;
      if (hint) {
        const sentences = segmentSentences({
          locale: 'fr',
          text: baseline.responseText,
        });
        const carrier = sentences.find((s) =>
          baseline.responseText
            .slice(s.start, s.end)
            .includes(hint.replace.from),
        );
        if (carrier) {
          positiveSpan = baseline.responseText
            .slice(carrier.start, carrier.end)
            .trim();
        }
      }
    }
    const negativeSpan = pair.negativeSpans[0];
    if (!positiveSpan || !negativeSpan) {
      skipped.push({ pairId, reason: 'span positif ou négatif introuvable' });
      continue;
    }

    const grounding = STRATUM_GROUNDING[pair.stratum] ?? [];
    const context = frames.get(pair.authoredAnswerId) ?? {
      dossier: '',
      frame: '',
    };

    for (const [member, span, response] of [
      ['positive', positiveSpan, baseline.responseText],
      ['negative', negativeSpan, mutant.responseText],
    ] as const) {
      const cardId = `C-${createHash('sha256')
        .update(`${SHUFFLE_SEED}::${pairId}::${member}`)
        .digest('hex')
        .slice(0, 10)}`;
      const start = response.indexOf(span);
      cards.push({
        atom: atom.atom,
        atomId: atom.atomId,
        candidateSpan: span,
        cardId,
        criterionLabel: criterion.label,
        ...(grounding.includes('dossier') ? { dossier: context.dossier } : {}),
        ...(grounding.includes('frame') ? { frame: context.frame } : {}),
        highlight: start >= 0 ? { end: start + span.length, start } : null,
        logicalOperator: atom.logicalOperator,
        predicate: atom.predicate,
        quantifier: atom.quantifier,
        response,
        responseArity: atom.responseArity,
        sourcePhrase: atom.sourcePhrase,
        stratum: atom.stratum,
        witnessGroupId: criterion.witnessGroupId,
        witnessRoles: criterion.witnessRoles,
      });
      key.push({ cardId, member, pairId });
    }
  }

  // Seeded order, with the two members of a pair kept far apart.
  //
  // Pure rejection sampling cannot do this: requiring 45 simultaneous gaps is
  // astronomically unlikely, and 500 draws found nothing. Instead, start from a
  // valid arrangement and mix it with random transpositions that preserve
  // validity — a walk over valid orders rather than a construction. The
  // starting arrangement is never the delivered one, and the balance check
  // below is what decides whether position could leak membership.
  const partner = new Map<string, string>();
  for (const pairId of new Set(key.map((k) => k.pairId))) {
    const [a, b] = key.filter((k) => k.pairId === pairId);
    if (a && b) {
      partner.set(a.cardId, b.cardId);
      partner.set(b.cardId, a.cardId);
    }
  }
  const next = rng(SHUFFLE_SEED);
  const half = cards.length / 2;

  // Seed arrangement: one member of each pair in each half, side chosen at
  // random so that membership does not follow the half.
  const pairIds = shuffled([...new Set(key.map((k) => k.pairId))], next);
  const order: Card[] = new Array<Card>(cards.length);
  const cardById = new Map(cards.map((card) => [card.cardId, card]));
  pairIds.forEach((pairId, index) => {
    const members = key.filter((k) => k.pairId === pairId);
    const flip = next() < 0.5;
    const first = members[flip ? 0 : 1];
    const second = members[flip ? 1 : 0];
    order[index] = cardById.get(first?.cardId ?? '') as Card;
    order[index + half] = cardById.get(second?.cardId ?? '') as Card;
  });

  const gapOf = (index: number, slots: Card[]): number => {
    const other = partner.get(slots[index]?.cardId ?? '');
    const otherIndex = slots.findIndex((card) => card.cardId === other);
    return otherIndex < 0
      ? Number.POSITIVE_INFINITY
      : Math.abs(otherIndex - index);
  };
  let accepted = 0;
  const MIXING_STEPS = 200000;
  for (let step = 0; step < MIXING_STEPS; step += 1) {
    const i = Math.floor(next() * order.length);
    const j = Math.floor(next() * order.length);
    if (i === j) continue;
    [order[i], order[j]] = [order[j] as Card, order[i] as Card];
    if (gapOf(i, order) < MIN_GAP || gapOf(j, order) < MIN_GAP) {
      [order[i], order[j]] = [order[j] as Card, order[i] as Card];
      continue;
    }
    accepted += 1;
  }
  const attempts = accepted;

  const position = new Map(order.map((card, index) => [card.cardId, index]));
  const memberOf = new Map(key.map((k) => [k.cardId, k.member]));
  const gaps = [...partner.entries()].map(([a, b]) =>
    Math.abs((position.get(a) ?? 0) - (position.get(b) ?? 0)),
  );

  const deck = {
    atomTaxonomyHash: taxonomy.contentHash,
    cards: order,
    manifestHash: manifest.contentHash,
    minimumGap: MIN_GAP,
    schemaVersion: 1,
    mixingStepsAccepted: attempts,
    shuffleSeed: SHUFFLE_SEED,
    status:
      'PASSE 1 AVEUGLE — la clé de correspondance est dans un fichier séparé, non destiné au relecteur.',
  };
  writeFileSync(OUT, `${JSON.stringify(deck, null, 2)}\n`);
  writeFileSync(
    path.resolve(REG, 'adjudication-deck.v1.key.json'),
    `${JSON.stringify({ deckSeed: SHUFFLE_SEED, key: key.sort((a, b) => a.cardId.localeCompare(b.cardId)), schemaVersion: 1 }, null, 2)}\n`,
  );

  const positives = order.filter((c) => memberOf.get(c.cardId) === 'positive');
  const negatives = order.filter((c) => memberOf.get(c.cardId) === 'negative');
  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };

  console.log(
    `cartes            : ${order.length} (${positives.length} positives, ${negatives.length} négatives)`,
  );
  console.log(`paires            : ${partner.size / 2}`);
  console.log(`paires écartées   : ${skipped.length}`);
  for (const entry of skipped) console.log(`   ${entry.reason}`);
  console.log(`transpositions acceptées : ${attempts} sur ${MIXING_STEPS}`);
  console.log(
    `écart minimum entre membres : ${Math.min(...gaps)} (exigé ${MIN_GAP})`,
  );
  console.log(
    `span introuvable dans le texte : ${order.filter((c) => c.highlight === null).length}`,
  );
  console.log(
    `longueur médiane du span — positifs ${median(positives.map((c) => c.candidateSpan.length))}, négatifs ${median(negatives.map((c) => c.candidateSpan.length))}`,
  );
  const blocks = 6;
  const perBlock = Array.from(
    { length: blocks },
    (_, b) =>
      order
        .slice((b * order.length) / blocks, ((b + 1) * order.length) / blocks)
        .filter((c) => memberOf.get(c.cardId) === 'positive').length,
  );
  console.log(`positifs par sixième du paquet : ${perBlock.join(', ')}`);
}

main();
