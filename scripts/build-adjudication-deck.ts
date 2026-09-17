/**
 * Builds the blind adjudication deck (V4.5-210, pass 1, v2).
 *
 * One card per pair member, plus shortened positive controls. A card carries the
 * atom, its predicate with named roles, one candidate span, the response
 * segmented into addressable sentences, and — for the local strata — a
 * fixed-size window instead of the whole response. It carries nothing that
 * identifies which member it is.
 *
 * v2 answers four defects found on v1:
 *  - the signature rendered witness roles as objects, and used the criterion's
 *    roles rather than the atom's arguments;
 *  - nothing let a reviewer say which span instantiates which role, so witness
 *    switching could survive adjudication;
 *  - the order kept pair members apart but let the same response reappear a few
 *    cards later, in groups of pure polarity;
 *  - response length separated the members on its own.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  loadRegressionSource,
  parseRegressionPool,
} from '../src/lib/ai-correction-regression-pool.ts';
import { planRegressionRun } from '../src/lib/ai-correction-regression-run.ts';
import {
  ADJUDICATION_SEGMENTER_VERSION,
  envelopeFor,
  segmentForAdjudication,
} from '../src/lib/ai-correction-adjudication-text.ts';
import { segmentSentences } from '../src/lib/ai-correction-regression-text.ts';

const REG = 'benchmarks/ai-correction/regression';
const POOL = path.resolve(REG, 'regression-pool.v1.json');
const TAXONOMY = path.resolve(REG, 'criterion-atoms.v3_2_2.json');
const MANIFEST = path.resolve(REG, 'atom-pair-manifest.v2.json');
const OUT = path.resolve(REG, 'adjudication-deck.v3.json');
const KEY_OUT = path.resolve(REG, 'adjudication-deck.v3.key.json');

/** Recorded so the order is reproducible and was not chosen after seeing it. */
const SHUFFLE_SEED = 'v4.5-210/adjudication-deck/pass-1/v3';
/**
 * Minimum cards between two cards that share something a reviewer could learn.
 *
 * The v2 comment justified a cluster target of 3 with a largest cluster of 27
 * cards. That number was stale — it came from an earlier control assignment.
 * The largest cluster carries 18 of the 106 cards, which needs 103 positions at
 * a gap of 6 and leaves room for the other two constraints. Measured, not
 * assumed: the builder prints the achieved gaps and the audit recomputes them.
 */
const MIN_GAP = { cluster: 6, pair: 8, response: 8 };
/** Fixed window, in characters, for the strata that judge one local span. */
const WINDOW = 340;
/** Strata whose response is withheld until the reviewer asks for it. */
const WINDOWED = new Set(['S1_span_local', 'S2_span_frame', 'S3_span_dossier']);

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
  grounding: string[];
  logicalOperator: string;
  predicate: string;
  quantifier: string;
  responseArity: string;
  sourcePhrase: string;
  stratum: string;
};
type WitnessRole = {
  cardinality: string;
  description: string;
  roleId: string;
  selection: string;
  source: string;
};
type Criterion = {
  atoms: Atom[];
  inPrimaryEndpoint: boolean;
  label: string;
  witnessGroupId: string;
  witnessRoles: WitnessRole[];
};

type Sentence = { end: number; id: string; sha: string; start: number };
type Role = {
  bindable: boolean;
  /** '1' | '>=1' | '>=2' | '>=0' — how many sentences may instantiate it. */
  cardinality: string;
  description: string;
  roleId: string;
  source: string;
};
type Card = {
  argumentRoles: Role[];
  atom: string;
  atomId: string;
  candidateSentenceIds: string[];
  candidateSpan: string;
  cardId: string;
  criterionLabel: string;
  dossier?: string;
  frame?: string;
  highlight: { end: number; start: number };
  logicalOperator: string;
  predicate: string;
  quantifier: string;
  response: string;
  responseArity: string;
  responseSha: string;
  segmenterVersion: string;
  sentences: Sentence[];
  sourcePhrase: string;
  stratum: string;
  window: { end: number; start: number } | null;
  witnessGroupId: string;
};
type KeyEntry = {
  cardId: string;
  /**
   * What the grader actually quoted, before expansion to its sentence
   * envelope. Never the verifier's input; measured on its own as a citation
   * fidelity endpoint.
   */
  citedFragment: string;
  /**
   * Set when the card sits in a sentence-count class carried by one member
   * only. Such a class is separable without reading anything, so these cards
   * are reported as a diagnostic stratum rather than counted in the primary
   * endpoint. The flag lives here, never on the card.
   */
  lengthDiagnostic?: boolean;
  clusterId: string;
  inPrimaryEndpoint: boolean;
  member: 'control_positive' | 'negative' | 'positive';
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

function shuffled<T>(items: T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** The one segmenter the runner also uses. Never a private copy. */
function sentencesOf(text: string): Sentence[] {
  return segmentForAdjudication(text).sentences.map((sentence) => ({
    end: sentence.end,
    id: sentence.id,
    sha: sentence.sha,
    start: sentence.start,
  }));
}

/** A window of fixed width centred on the span, clamped to the text. */
function windowAround(
  text: string,
  span: { end: number; start: number },
): {
  end: number;
  start: number;
} {
  const centre = (span.start + span.end) / 2;
  let start = Math.round(centre - WINDOW / 2);
  let end = start + WINDOW;
  if (start < 0) {
    start = 0;
    end = Math.min(text.length, WINDOW);
  }
  if (end > text.length) {
    end = text.length;
    start = Math.max(0, end - WINDOW);
  }
  // Never cut the span itself out of its own window.
  return { end: Math.max(end, span.end), start: Math.min(start, span.start) };
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

  /** Roles named by an atom, resolved against the criterion and the externals. */
  function rolesOf(atom: Atom, criterion: Criterion): Role[] {
    const byId = new Map(
      criterion.witnessRoles.map((role) => [role.roleId, role]),
    );
    return atom.arguments.map((roleId) => {
      const declared = byId.get(roleId);
      if (declared) {
        return {
          bindable: declared.source === 'response',
          cardinality: declared.cardinality,
          description: declared.description,
          roleId,
          source: declared.source,
        };
      }
      if (roleId === 'task_frame') {
        return {
          bindable: false,
          cardinality: '1',
          description: 'la consigne',
          roleId,
          source: 'task_frame',
        };
      }
      if (roleId === 'dossier') {
        return {
          bindable: false,
          cardinality: '1',
          description: 'le dossier',
          roleId,
          source: 'dossier',
        };
      }
      // `response` as an argument means the whole answer, which needs no choice.
      return {
        bindable: false,
        cardinality: '1',
        description: 'la réponse entière',
        roleId,
        source: 'response_whole',
      };
    });
  }

  /**
   * Both sides are shown at sentence granularity.
   *
   * A negative span is a fragment the grader chose; a positive span is a whole
   * authored sentence. Judged as they come, length alone separated them
   * (AUC 0.697). Expanding both to their containing sentences brings that to
   * 0.434 — near chance — and is conservative for our claim: it gives the
   * negative more text to be found sufficient on, never less. The fragment the
   * grader actually cited is kept in the key file for traceability.
   */
  function makeCard(input: {
    atom: Atom;
    criterion: Criterion;
    clusterId: string;
    discriminator: string;
    response: string;
    span: string;
  }): { card: Card; citedFragment: string } | null {
    const segmentation = segmentForAdjudication(input.response);
    const envelope = envelopeFor({
      fragment: input.span,
      segmentation,
      text: input.response,
    });
    if (!envelope) return null;
    const sentences = sentencesOf(input.response);
    const highlight = { end: envelope.end, start: envelope.start };
    const grounding = STRATUM_GROUNDING[input.atom.stratum] ?? [];
    const context = frames.get(input.clusterId) ?? { dossier: '', frame: '' };
    const card: Card = {
      argumentRoles: rolesOf(input.atom, input.criterion),
      atom: input.atom.atom,
      atomId: input.atom.atomId,
      candidateSentenceIds: sentences
        .filter((s) => s.start < highlight.end && s.end > highlight.start)
        .map((s) => s.id),
      candidateSpan: input.response
        .slice(highlight.start, highlight.end)
        .trim(),
      cardId: `C-${createHash('sha256')
        .update(`${SHUFFLE_SEED}::${input.discriminator}`)
        .digest('hex')
        .slice(0, 10)}`,
      criterionLabel: input.criterion.label,
      ...(grounding.includes('dossier') ? { dossier: context.dossier } : {}),
      ...(grounding.includes('frame') ? { frame: context.frame } : {}),
      highlight,
      logicalOperator: input.atom.logicalOperator,
      predicate: input.atom.predicate,
      quantifier: input.atom.quantifier,
      response: input.response,
      responseArity: input.atom.responseArity,
      responseSha: segmentation.responseSha,
      segmenterVersion: segmentation.segmenterVersion,
      sentences,
      sourcePhrase: input.atom.sourcePhrase,
      stratum: input.atom.stratum,
      window: WINDOWED.has(input.atom.stratum)
        ? windowAround(input.response, highlight)
        : null,
      witnessGroupId: input.criterion.witnessGroupId,
    };
    return { card, citedFragment: input.span };
  }

  const cards: Card[] = [];
  const key: KeyEntry[] = [];
  const skipped: { reason: string }[] = [];
  const hashOf = (text: string): string =>
    createHash('sha256').update(text).digest('hex').slice(0, 16);

  // Carriers, kept so the controls can avoid deleting a sentence that matters.
  type Carrier = {
    atom: Atom;
    criterion: Criterion;
    clusterId: string;
    span: string;
  };
  const carriers: Carrier[] = [];
  const protectedSpans = new Map<string, Set<string>>();

  for (const pair of manifest.pairs) {
    const criterion = taxonomy.criteria[pair.criterionKey];
    const atom = criterion?.atoms.find((a) => a.atomId === pair.atomId);
    const pairId = createHash('sha256')
      .update(`${pair.mutantId}::${pair.atomId}`)
      .digest('hex')
      .slice(0, 16);
    if (!criterion || !atom) {
      skipped.push({ reason: 'atome introuvable' });
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
      skipped.push({ reason: 'texte de base ou mutant introuvable' });
      continue;
    }

    const kind = pair.mutantId.split('#')[1] ?? '';
    let positiveSpan: string | null = null;
    const baseSentences = segmentSentences({
      locale: 'fr',
      text: baseline.responseText,
    });
    if (kind === 'SENTENCE_DELETION') {
      const index = Number.parseInt(pair.mutantId.split('@').pop() ?? '', 10);
      const sentence = baseSentences[index];
      if (sentence) {
        positiveSpan = baseline.responseText
          .slice(sentence.start, sentence.end)
          .trim();
      }
    } else if (kind === 'FACT_INVERSION') {
      const hint = poolCase.mutationHints.find(
        (h) =>
          h.kind === 'FACT_INVERSION' && h.criterionKey === pair.criterionKey,
      ) as { replace: { from: string } } | undefined;
      const carrier = hint
        ? baseSentences.find((s) =>
            baseline.responseText
              .slice(s.start, s.end)
              .includes(hint.replace.from),
          )
        : undefined;
      if (carrier) {
        positiveSpan = baseline.responseText
          .slice(carrier.start, carrier.end)
          .trim();
      }
    }
    const negativeSpan = pair.negativeSpans[0];
    if (!positiveSpan || !negativeSpan) {
      skipped.push({ reason: 'span positif ou négatif introuvable' });
      continue;
    }

    const spans =
      protectedSpans.get(pair.authoredAnswerId) ?? new Set<string>();
    spans.add(positiveSpan);
    spans.add(negativeSpan);
    protectedSpans.set(pair.authoredAnswerId, spans);
    carriers.push({
      atom,
      clusterId: pair.authoredAnswerId,
      criterion,
      span: positiveSpan,
    });

    for (const [member, span, response] of [
      ['positive', positiveSpan, baseline.responseText],
      ['negative', negativeSpan, mutant.responseText],
    ] as const) {
      const built = makeCard({
        atom,
        clusterId: pair.authoredAnswerId,
        criterion,
        discriminator: `${pairId}::${member}`,
        response,
        span,
      });
      if (!built) {
        skipped.push({ reason: `span absent de la réponse (${member})` });
        continue;
      }
      const card = built.card;
      cards.push(card);
      key.push({
        cardId: card.cardId,
        citedFragment: built.citedFragment,
        clusterId: pair.authoredAnswerId,
        inPrimaryEndpoint: pair.inPrimaryEndpoint,
        member,
        pairId,
        responseHash: hashOf(response),
      });
    }
  }

  // Shortened positive controls: a genuine carrier, in a response that
  // irrelevant sentences were removed from, until its length lands inside the
  // negatives' band. The first attempt removed a single sentence and produced
  // controls with a median of 679 characters — longer than the positives, so
  // they made the length signal worse instead of breaking it. The target is
  // now drawn from the observed negative lengths.
  const negativeCards = key
    .filter((entry) => entry.member === 'negative')
    .map((entry) => cards.find((card) => card.cardId === entry.cardId))
    .filter((card): card is Card => card !== undefined);
  const negativeLengths = negativeCards
    .map((card) => card.response.length)
    .sort((a, b) => a - b);
  // Sentence count separated the members on its own (AUC 0.614), with whole
  // counts carried by one member only. Controls therefore aim at a drawn
  // sentence count too, not just a drawn character length.
  const negativeSentenceCounts = negativeCards
    .map((card) => card.sentences.length)
    .sort((a, b) => a - b);
  const controls: Card[] = [];
  const seenControl = new Set<string>();
  const controlNext = rng(`${SHUFFLE_SEED}/controls`);
  /**
   * A control may not push its cluster past what the ordering can space out.
   *
   * With 106 cards and a cluster gap of 6, no cluster may exceed
   * floor(105 / 6) + 1 = 18 cards. Left unbounded, all sixteen controls landed
   * on the one cluster with the most carriers, taking it to 27 and making the
   * order infeasible — the search then stalled at a gap of 1. Two per cluster,
   * never above the ceiling.
   */
  const clusterLoad = new Map<string, number>();
  for (const entry of key) {
    clusterLoad.set(
      entry.clusterId,
      (clusterLoad.get(entry.clusterId) ?? 0) + 1,
    );
  }
  const clusterCeiling =
    Math.floor((cards.length + 16 - 1) / MIN_GAP.cluster) + 1;
  const controlsPerCluster = new Map<string, number>();
  for (const carrier of carriers) {
    if (controls.length >= 16) break;
    const signature = `${carrier.clusterId}::${carrier.atom.atomId}`;
    if (seenControl.has(signature)) continue;
    if ((controlsPerCluster.get(carrier.clusterId) ?? 0) >= 2) continue;
    if ((clusterLoad.get(carrier.clusterId) ?? 0) + 1 > clusterCeiling)
      continue;
    const baseline = [...plan.unitsByBenchmarkCaseId.values()].find(
      (unit) =>
        unit.poolCaseId === carrier.clusterId && unit.mutantId === undefined,
    );
    if (!baseline) continue;
    // Only this atom's own carrier is protected. v2 protected every span of the
    // cluster, which on a busy cluster left almost nothing removable and kept
    // the controls long. The other criteria's carriers are not being judged on
    // this card; removing them leaves a response no more damaged than a
    // negative's, which is the point.
    const guarded = new Set<string>([carrier.span]);
    const target =
      negativeLengths[Math.floor(controlNext() * negativeLengths.length)] ??
      negativeLengths[0] ??
      0;
    const targetSentences =
      negativeSentenceCounts[
        Math.floor(controlNext() * negativeSentenceCounts.length)
      ] ??
      negativeSentenceCounts[0] ??
      1;

    // Remove the longest sentence that carries nothing anyone is judging,
    // repeatedly, until both the drawn length and the drawn sentence count are
    // reached.
    let response = baseline.responseText;
    for (
      let pass = 0;
      pass < 12 &&
      (response.length > target ||
        segmentSentences({ locale: 'fr', text: response }).length >
          targetSentences);
      pass += 1
    ) {
      const sentences = segmentSentences({ locale: 'fr', text: response });
      if (sentences.length < 2) break;
      const removable = sentences
        .map((sentence) => ({
          ...sentence,
          text: response.slice(sentence.start, sentence.end),
        }))
        .filter(
          (sentence) =>
            ![...guarded].some(
              (span) =>
                sentence.text.includes(span) ||
                span.includes(sentence.text.trim()),
            ),
        )
        .sort((a, b) => b.text.length - a.text.length);
      const victim = removable[0];
      if (!victim) break;
      response = `${response.slice(0, victim.start)}${response.slice(victim.end)}`;
    }
    response = response.replace(/\s{2,}/gu, ' ').trim();
    // A control only earns its place if it sits inside the negatives' band.
    if (response.length > (negativeLengths.at(-1) ?? 0)) continue;
    const built = makeCard({
      atom: carrier.atom,
      clusterId: carrier.clusterId,
      criterion: carrier.criterion,
      discriminator: `control::${signature}`,
      response,
      span: carrier.span,
    });
    if (!built) continue;
    seenControl.add(signature);
    controlsPerCluster.set(
      carrier.clusterId,
      (controlsPerCluster.get(carrier.clusterId) ?? 0) + 1,
    );
    clusterLoad.set(
      carrier.clusterId,
      (clusterLoad.get(carrier.clusterId) ?? 0) + 1,
    );
    controls.push(built.card);
    key.push({
      cardId: built.card.cardId,
      citedFragment: built.citedFragment,
      clusterId: carrier.clusterId,
      inPrimaryEndpoint: false,
      member: 'control_positive',
      pairId: null,
      responseHash: hashOf(built.card.response),
    });
  }
  cards.push(...controls);

  // Order: simulated annealing over arrangements, scored by how far each
  // constraint is from its target. Greedy descent stalls at 7 violations; the
  // search needs to accept a worse arrangement sometimes to leave a local
  // minimum. Cost is evaluated only around the two swapped positions.
  const byId = new Map(key.map((entry) => [entry.cardId, entry]));
  const next = rng(SHUFFLE_SEED);
  const order = shuffled(cards, next);
  const REACH = Math.max(MIN_GAP.cluster, MIN_GAP.pair, MIN_GAP.response);

  /** How much the card at `index` violates, counting only forward neighbours. */
  const costAt = (slots: Card[], index: number): number => {
    const a = byId.get(slots[index]?.cardId ?? '');
    if (!a) return 0;
    let cost = 0;
    for (
      let j = Math.max(0, index - REACH);
      j <= Math.min(slots.length - 1, index + REACH);
      j += 1
    ) {
      if (j === index) continue;
      const b = byId.get(slots[j]?.cardId ?? '');
      if (!b) continue;
      const gap = Math.abs(j - index);
      if (a.pairId !== null && a.pairId === b.pairId && gap < MIN_GAP.pair) {
        cost += (MIN_GAP.pair - gap) * 4;
      }
      if (a.responseHash === b.responseHash && gap < MIN_GAP.response) {
        cost += (MIN_GAP.response - gap) * 2;
      }
      if (a.clusterId === b.clusterId && gap < MIN_GAP.cluster) {
        cost += MIN_GAP.cluster - gap;
      }
    }
    return cost;
  };
  const neighbourhood = (slots: Card[], i: number, j: number): number => {
    let total = 0;
    const touched = new Set<number>();
    for (const centre of [i, j]) {
      for (
        let k = Math.max(0, centre - REACH);
        k <= Math.min(slots.length - 1, centre + REACH);
        k += 1
      ) {
        touched.add(k);
      }
    }
    for (const index of touched) total += costAt(slots, index);
    return total;
  };
  const totalCost = (slots: Card[]): number => {
    let total = 0;
    for (let i = 0; i < slots.length; i += 1) total += costAt(slots, i);
    return total / 2;
  };

  let steps = 0;
  let temperature = 6;
  for (; steps < 3000000; steps += 1) {
    // The delta accounting guides the walk; only a full recount can end it.
    if (steps % 50000 === 0 && totalCost(order) === 0) break;
    const i = Math.floor(next() * order.length);
    const j = Math.floor(next() * order.length);
    if (i === j) continue;
    const before = neighbourhood(order, i, j);
    [order[i], order[j]] = [order[j] as Card, order[i] as Card];
    const after = neighbourhood(order, i, j);
    const delta = after - before;
    if (delta > 0 && next() >= Math.exp(-delta / temperature)) {
      [order[i], order[j]] = [order[j] as Card, order[i] as Card];
    }
    if (steps % 20000 === 0) temperature = Math.max(0.02, temperature * 0.82);
  }
  const current = totalCost(order);

  // Achieved gaps, recomputed from the delivered order rather than assumed.
  const achieved = { cluster: Infinity, pair: Infinity, response: Infinity };
  for (let i = 0; i < order.length; i += 1) {
    const a = byId.get(order[i]?.cardId ?? '');
    if (!a) continue;
    for (let j = i + 1; j < order.length; j += 1) {
      const b = byId.get(order[j]?.cardId ?? '');
      if (!b) continue;
      const gap = j - i;
      if (a.pairId !== null && a.pairId === b.pairId)
        achieved.pair = Math.min(achieved.pair, gap);
      if (a.responseHash === b.responseHash)
        achieved.response = Math.min(achieved.response, gap);
      if (a.clusterId === b.clusterId)
        achieved.cluster = Math.min(achieved.cluster, gap);
    }
  }

  /**
   * Sentence-count classes carried by one member only.
   *
   * A card in such a class is separable without reading a word, so it cannot
   * count towards the primary endpoint. Controls closed the short classes; the
   * long ones cannot be closed at all, because a negative with five or seven
   * sentences would require a baseline that does not exist. They are named here
   * and reported as a diagnostic stratum. The flag lives in the key: on the
   * card it would be the very marker this deck removes.
   */
  const byCount = new Map<number, KeyEntry[]>();
  for (const entry of key) {
    const card = cards.find((candidate) => candidate.cardId === entry.cardId);
    if (!card) continue;
    const bucket = byCount.get(card.sentences.length) ?? [];
    bucket.push(entry);
    byCount.set(card.sentences.length, bucket);
  }
  const pureClasses: { count: number; member: string; cards: number }[] = [];
  for (const [count, entries] of byCount) {
    const polarities = new Set(
      entries.map((entry) =>
        entry.member === 'negative' ? 'negative' : 'positive',
      ),
    );
    if (polarities.size > 1) continue;
    pureClasses.push({
      cards: entries.length,
      count,
      member: [...polarities][0] ?? '?',
    });
    for (const entry of entries) entry.lengthDiagnostic = true;
  }

  const deck = {
    atomTaxonomyHash: taxonomy.contentHash,
    cards: order,
    manifestHash: manifest.contentHash,
    minimumGapAchieved: achieved,
    minimumGapTarget: MIN_GAP,
    schemaVersion: 2,
    shuffleSeed: SHUFFLE_SEED,
    status:
      'PASSE 1 AVEUGLE — la clé de correspondance est dans un fichier séparé, non destiné au relecteur.',
    supersedes: {
      contentHash:
        'sha256:f1f25fc9a107e7903069f4b01a0dd6096db5da97a2022848546fcf92c8b76945',
      file: 'adjudication-deck.v1.json',
      reason:
        "v1 gardait les membres d'une paire éloignés mais laissait la même réponse réapparaître à moins de huit cartes, en groupes de polarité pure ; la longueur séparait les membres à elle seule ; la signature rendait les rôles comme objets ; rien ne permettait de dire quel passage instancie quel témoin.",
    },
    segmenterVersion: ADJUDICATION_SEGMENTER_VERSION,
    windowCharacters: WINDOW,
    windowedStrata: [...WINDOWED].sort(),
  };
  writeFileSync(OUT, `${JSON.stringify(deck, null, 2)}\n`);
  writeFileSync(
    KEY_OUT,
    `${JSON.stringify(
      {
        deckSeed: SHUFFLE_SEED,
        key: [...key].sort((a, b) => a.cardId.localeCompare(b.cardId)),
        schemaVersion: 2,
      },
      null,
      2,
    )}\n`,
  );

  const member = (card: Card) => byId.get(card.cardId)?.member;
  const pos = order.filter((c) => member(c) === 'positive');
  const neg = order.filter((c) => member(c) === 'negative');
  const ctl = order.filter((c) => member(c) === 'control_positive');
  console.log(
    `cartes             : ${order.length} (${pos.length} positives, ${neg.length} négatives, ${ctl.length} contrôles raccourcis)`,
  );
  console.log(`écartées           : ${skipped.length}`);
  console.log(`coût d'ordre       : ${current} après ${steps} pas`);
  console.log(
    `écarts atteints    : paire ${achieved.pair}, réponse ${achieved.response}, grappe ${achieved.cluster} (visés ${MIN_GAP.pair}/${MIN_GAP.response}/${MIN_GAP.cluster})`,
  );
  console.log(
    `fenêtre            : ${WINDOW} caractères sur ${order.filter((c) => c.window).length} cartes`,
  );
  console.log(
    `  dont réponse plus courte que la fenêtre : ${order.filter((c) => c.window && c.response.length <= WINDOW).length}`,
  );
  console.log(
    `classes de phrases à polarité pure : ${pureClasses.length} (${pureClasses.reduce((sum, entry) => sum + entry.cards, 0)} cartes en strate diagnostique)`,
  );
  for (const entry of [...pureClasses].sort((a, b) => a.count - b.count)) {
    console.log(
      `   ${entry.count} phrases : ${entry.cards} cartes, toutes ${entry.member}`,
    );
  }
  console.log(
    `rôles liables — cartes avec 0/1/2 : ${[0, 1, 2].map((n) => order.filter((c) => c.argumentRoles.filter((r) => r.bindable).length === n).length).join(' / ')}`,
  );
}

main();
