import {
  absoluteReading,
  pass1Reading,
  VERDICT_RANK,
  type VerifierVerdict,
} from './ai-correction-atom-verifier-protocol.js';
export {
  assertBlind,
  parseVerifierAnswer,
  renderVerifierCard,
  VERIFIER_JSON_SCHEMA,
  VERIFIER_SYSTEM_PROMPT,
  type VerifierCard,
  type VerifierVerdict,
} from './ai-correction-atom-verifier-protocol.js';
import { summariseSourceClusters } from './ai-correction-atom-verifier-clusters.js';

/**
 * V4.5-210 — the atomic verifier measurement, pure parts.
 *
 * One atom, one card, one blind question, a JSON verdict. The runner in
 * `scripts/run-atom-verifier.ts` handles files, network and money; this
 * module holds what can be tested without either: which pairs are labelled,
 * what the model is shown, how verdicts are ranked, how a pair is scored,
 * and how the pre-declared thresholds read a summary.
 *
 * Thresholds and the rank scale are declared here before the first call and
 * copied into `docs/V4_5_210_PREREGISTRATION.md`. Changing them after a run
 * is a new experiment, not a correction.
 */

export const THRESHOLDS = {
  /** Pairs of the labelled set. Fixed by the owner's pass 2. */
  labelledPairs: 30,
  /** `narrow` and `proceed` need this many pairs won by majority-of-3. */
  pairwiseProceed: 27,
  /** Below this, the route is closed for this model. */
  pairwiseStop: 24,
  /** Pairs whose outcome differs between repetitions; more than this is unstable. */
  flipsProceed: 2,
  /** Every model flipping on more than this: the sample cannot choose. */
  flipsStop: 5,
  /** Secondary absolute floors, on majority verdicts. */
  hardNegativeRejection: 0.86,
  trueEvidenceAcceptance: 0.9,
  repetitions: 3,
  budgetCapUsd: 3,
} as const;

export type PairRecord = {
  atomId: string;
  cards: string[];
  pairId: string;
  primary: boolean;
  stratum: string;
};
export type Pass2Decision = {
  choice: 'A' | 'B' | 'both' | 'neither';
  leftCardId: string;
  pairId: string;
  rightCardId: string;
};
export type KeyEntry = {
  cardId: string;
  clusterId: string;
  member: 'positive' | 'negative' | 'control_positive';
  pairId: string;
};

export type LabelledPair = {
  atomId: string;
  clusterId: string;
  damagedCardId: string;
  originalCardId: string;
  pairId: string;
  stratum: string;
};

/**
 * The labelled set: primary pairs where the owner's forced choice fell on the
 * positive member. Ties and damaged-chosen pairs are left out, as declared.
 */
export function selectLabelledPairs(input: {
  decisions: Pass2Decision[];
  key: KeyEntry[];
  pairs: PairRecord[];
}): LabelledPair[] {
  const member = new Map(input.key.map((k) => [k.cardId, k.member]));
  const clusters = new Map(input.key.map((k) => [k.cardId, k.clusterId]));
  const byPair = new Map(input.pairs.map((p) => [p.pairId, p]));
  const out: LabelledPair[] = [];
  for (const d of input.decisions) {
    const pair = byPair.get(d.pairId);
    if (!pair || !pair.primary) continue;
    if (d.choice !== 'A' && d.choice !== 'B') continue;
    const chosen = d.choice === 'A' ? d.leftCardId : d.rightCardId;
    const other = d.choice === 'A' ? d.rightCardId : d.leftCardId;
    if (member.get(chosen) !== 'positive') continue;
    if (member.get(other) !== 'negative') {
      throw new Error(`ATOM_VERIFIER_PAIR_NOT_POSITIVE_NEGATIVE ${d.pairId}`);
    }
    const clusterId = clusters.get(chosen);
    if (!clusterId || clusters.get(other) !== clusterId)
      throw new Error('ATOM_VERIFIER_CLUSTER_MISSING_OR_MISMATCH');
    out.push({
      clusterId,
      atomId: pair.atomId,
      damagedCardId: other,
      originalCardId: chosen,
      pairId: pair.pairId,
      stratum: pair.stratum,
    });
  }
  return out.sort((a, b) => a.pairId.localeCompare(b.pairId));
}

/**
 * Majority of the repetitions. Two identical verdicts out of three win; three
 * different verdicts, or a missing one, give `null` (undecided), never a
 * verdict picked from noise.
 */
export function majorityVerdict(
  verdicts: (VerifierVerdict | null)[],
): VerifierVerdict | null {
  const counts = new Map<VerifierVerdict, number>();
  for (const v of verdicts) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: VerifierVerdict | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v;
      bestCount = n;
      tied = false;
    } else if (n === bestCount) {
      tied = true;
    }
  }
  if (best === null || tied || bestCount * 2 <= verdicts.length) return null;
  return best;
}

export type PairOutcome = 'original' | 'damaged' | 'tie' | 'undecided';

export function pairOutcome(
  original: VerifierVerdict | null,
  damaged: VerifierVerdict | null,
): PairOutcome {
  if (original === null || damaged === null) return 'undecided';
  const a = VERDICT_RANK[original];
  const b = VERDICT_RANK[damaged];
  if (a > b) return 'original';
  if (a < b) return 'damaged';
  return 'tie';
}

export type CardObservation = {
  cardId: string;
  repetition: number;
  verdict: VerifierVerdict | null;
};

export type ModelSummary = {
  validity: { status: 'MEASURED' | 'UNMEASURED'; reasons: string[] };
  clusterUncertainty: ReturnType<typeof summariseSourceClusters>;
  absoluteAgainstPass1: {
    agreements: number;
    compared: number;
  } | null;
  flips: number;
  hardNegativeRejection: {
    abstained: number;
    denominator: number;
    rejected: number;
  };
  pairs: {
    damaged: number;
    original: number;
    tie: number;
    undecided: number;
  };
  perPair: {
    damagedMajority: VerifierVerdict | null;
    originalMajority: VerifierVerdict | null;
    outcome: PairOutcome;
    pairId: string;
    perRepetition: PairOutcome[];
  }[];
  reading: 'proceed' | 'narrow' | 'stop' | 'indeterminate' | 'UNMEASURED';
  trueEvidenceAcceptance: {
    abstained: number;
    accepted: number;
    denominator: number;
  };
  unparsed: number;
};

/**
 * Summary for one model over the labelled pairs. `pass1` is the owner's
 * absolute verdict per card when available, for the secondary comparison.
 */
export function summariseModel(input: {
  observations: CardObservation[];
  pairs: LabelledPair[];
  pass1?: Map<string, 'DIRECT' | 'NOT_DIRECT' | 'AMBIGUOUS'>;
  repetitions: number;
  invalidReasons?: string[];
}): ModelSummary {
  const reasons = [...(input.invalidReasons ?? [])];
  const expected = new Set(
    input.pairs.flatMap((p) => [p.originalCardId, p.damagedCardId]),
  );
  const seen = new Set<string>();
  const byCard = new Map<string, (VerifierVerdict | null)[]>();
  let unparsed = 0;
  for (const o of input.observations) {
    const slot = `${o.cardId}/${o.repetition}`;
    if (
      !expected.has(o.cardId) ||
      !Number.isInteger(o.repetition) ||
      o.repetition < 1 ||
      o.repetition > input.repetitions ||
      seen.has(slot)
    ) {
      reasons.push('INVALID_OR_DUPLICATE_OBSERVATION');
      continue;
    }
    seen.add(slot);
    const list = byCard.get(o.cardId) ?? [];
    list[o.repetition - 1] = o.verdict;
    byCard.set(o.cardId, list);
    if (o.verdict === null) unparsed += 1;
  }
  if (seen.size !== expected.size * input.repetitions || unparsed > 0)
    reasons.push('INCOMPLETE_OR_INVALID_TRANSPORT');
  if (
    input.pairs.length !== THRESHOLDS.labelledPairs ||
    input.repetitions !== THRESHOLDS.repetitions
  )
    reasons.push('NON_PREREGISTERED_SAMPLE');
  const reps = (cardId: string): (VerifierVerdict | null)[] => {
    const list = byCard.get(cardId) ?? [];
    return Array.from({ length: input.repetitions }, (_, i) => list[i] ?? null);
  };
  const pairs = { damaged: 0, original: 0, tie: 0, undecided: 0 };
  let flips = 0;
  const perPair: ModelSummary['perPair'] = [];
  const rejection = { abstained: 0, denominator: 0, rejected: 0 };
  const acceptance = { abstained: 0, accepted: 0, denominator: 0 };
  let agreements = 0;
  let compared = 0;
  for (const pair of input.pairs) {
    const o = reps(pair.originalCardId);
    const d = reps(pair.damagedCardId);
    const originalMajority = majorityVerdict(o);
    const damagedMajority = majorityVerdict(d);
    const outcome = pairOutcome(originalMajority, damagedMajority);
    pairs[outcome] += 1;
    const perRepetition = o.map((_, i) =>
      pairOutcome(o[i] ?? null, d[i] ?? null),
    );
    if (new Set(perRepetition).size > 1) flips += 1;
    perPair.push({
      damagedMajority,
      originalMajority,
      outcome,
      pairId: pair.pairId,
      perRepetition,
    });
    if (damagedMajority !== null) {
      rejection.denominator += 1;
      const r = absoluteReading(damagedMajority);
      if (r === 'reject') rejection.rejected += 1;
      if (r === 'abstain') rejection.abstained += 1;
    }
    if (originalMajority !== null) {
      acceptance.denominator += 1;
      const r = absoluteReading(originalMajority);
      if (r === 'accept') acceptance.accepted += 1;
      if (r === 'abstain') acceptance.abstained += 1;
    }
    if (input.pass1) {
      for (const [cardId, majority] of [
        [pair.originalCardId, originalMajority],
        [pair.damagedCardId, damagedMajority],
      ] as const) {
        const human = input.pass1.get(cardId);
        if (!human || majority === null) continue;
        compared += 1;
        if (pass1Reading(human) === absoluteReading(majority)) agreements += 1;
      }
    }
  }
  const won = pairs.original;
  const rejectionRate =
    rejection.denominator === 0
      ? 0
      : rejection.rejected / rejection.denominator;
  const acceptanceRate =
    acceptance.denominator === 0
      ? 0
      : acceptance.accepted / acceptance.denominator;
  let reading: ModelSummary['reading'];
  if (reasons.length > 0) {
    reading = 'UNMEASURED';
  } else if (won < THRESHOLDS.pairwiseStop || flips > THRESHOLDS.flipsStop) {
    reading = 'stop';
  } else if (
    won >= THRESHOLDS.pairwiseProceed &&
    flips <= THRESHOLDS.flipsProceed
  ) {
    reading =
      rejectionRate >= THRESHOLDS.hardNegativeRejection &&
      acceptanceRate >= THRESHOLDS.trueEvidenceAcceptance
        ? 'proceed'
        : 'narrow';
  } else {
    reading = 'indeterminate';
  }
  const uncertainty = summariseSourceClusters(input.pairs, perPair);
  if (reasons.length > 0) {
    uncertainty.bootstrap95 = null;
    uncertainty.clusterWeightedWinRate = null;
  }
  return {
    validity: {
      status: reasons.length ? 'UNMEASURED' : 'MEASURED',
      reasons: [...new Set(reasons)],
    },
    clusterUncertainty: uncertainty,
    absoluteAgainstPass1: input.pass1 ? { agreements, compared } : null,
    flips,
    hardNegativeRejection: rejection,
    pairs,
    perPair,
    reading,
    trueEvidenceAcceptance: acceptance,
    unparsed,
  };
}

/** P(X ≥ k) for X ~ Binomial(n, 1/2). */
export function binomialUpperTail(n: number, k: number): number {
  let total = 0;
  for (let i = k; i <= n; i += 1) {
    let c = 1;
    for (let j = 1; j <= i; j += 1) c = (c * (n - i + j)) / j;
    total += c;
  }
  return total / 2 ** n;
}

export type PriceUsdPerToken = { completion: number; prompt: number };

/** Rough token count for French prose: about 3.2 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}

export function estimateCostUsd(input: {
  completionTokensPerCall: number;
  price: PriceUsdPerToken;
  promptTokens: number[];
  repetitions: number;
}): number {
  const prompt =
    input.promptTokens.reduce((a, b) => a + b, 0) * input.repetitions;
  const completion =
    input.completionTokensPerCall *
    input.promptTokens.length *
    input.repetitions;
  return prompt * input.price.prompt + completion * input.price.completion;
}

/** mulberry32, seeded from the first 8 hex digits of a sha256, as the pages do. */
export function seededShuffle<T>(items: T[], seedHex: string): T[] {
  let a = Number.parseInt(seedHex.slice(0, 8), 16) >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
