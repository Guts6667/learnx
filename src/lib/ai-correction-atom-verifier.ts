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

export const VERIFIER_VERDICTS = [
  'direct',
  'partial',
  'unsupported',
  'contradicted',
  'ambiguous',
] as const;
export type VerifierVerdict = (typeof VERIFIER_VERDICTS)[number];

/**
 * Ordinal rank used for the pairwise metric. A pair is won when the original
 * ranks strictly above its damaged twin. `ambiguous` sits between `partial`
 * and `unsupported` so that an abstention on the damaged copy against a
 * `direct` on the original still counts as a win, and an abstention on the
 * original against anything but `contradicted` does not.
 */
export const VERDICT_RANK: Record<VerifierVerdict, number> = {
  ambiguous: 1,
  contradicted: -1,
  direct: 3,
  partial: 2,
  unsupported: 0,
};

/** Absolute reading of a verdict, for the secondary metrics. */
export function absoluteReading(
  verdict: VerifierVerdict,
): 'accept' | 'reject' | 'abstain' {
  if (verdict === 'direct') return 'accept';
  if (verdict === 'ambiguous') return 'abstain';
  return 'reject';
}

/** Pass-1 human verdicts mapped onto the same three readings. */
export function pass1Reading(
  verdict: 'DIRECT' | 'NOT_DIRECT' | 'AMBIGUOUS',
): 'accept' | 'reject' | 'abstain' {
  if (verdict === 'DIRECT') return 'accept';
  if (verdict === 'AMBIGUOUS') return 'abstain';
  return 'reject';
}

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
  member: 'positive' | 'negative' | 'control_positive';
  pairId: string;
};

export type LabelledPair = {
  atomId: string;
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
    out.push({
      atomId: pair.atomId,
      damagedCardId: other,
      originalCardId: chosen,
      pairId: pair.pairId,
      stratum: pair.stratum,
    });
  }
  return out.sort((a, b) => a.pairId.localeCompare(b.pairId));
}

export type VerifierCard = {
  atom: string;
  atomId: string;
  cardId: string;
  dossier?: string;
  frame?: string;
  highlight: { end: number; start: number };
  quantifier: string;
  response: string;
  sentences: { end: number; id: string; start: number }[];
  stratum: string;
  window: { end: number; start: number } | null;
};

const singleSpan = (card: VerifierCard): boolean =>
  /^S[123]_/u.test(card.stratum);
const wholeCopy = (card: VerifierCard): boolean =>
  card.stratum.startsWith('S7');

export const VERIFIER_SYSTEM_PROMPT = `Tu relis une copie d'élève à l'aveugle. Une seule question, en français, à propos d'un extrait de copie. Tu ne sais rien d'autre : ni le barème, ni la note, ni ce que d'autres ont répondu.

RÈGLES

1. Réponds avec ce que la carte te laisse regarder, rien d'autre. N'utilise pas de connaissances extérieures et ne suppose rien qui n'est pas écrit. Quand une consigne ou un dossier sont donnés, ils servent à comprendre ; la réponse porte sur la copie.

2. La portée est indiquée sur la carte :
   - « la phrase marquée, prise seule » : la réponse porte uniquement sur la phrase entre ⟦ et ⟧. Le reste de l'extrait sert à comprendre, il ne compte pas. Si ta réponse ne tient que grâce à une autre phrase, elle ne tient pas.
   - « la copie, en citant les phrases » : la réponse porte sur la copie entière ; cite, par leur numéro, les phrases qui te font répondre : une phrase par chose concernée, jamais toutes.
   - « la copie entière » : la réponse porte sur toute la copie, sans citation.

3. Une phrase qui parle du bon sujet n'est pas forcément la preuve. Ne réponds « direct » que si la phrase, ou les phrases citées, établissent par elles-mêmes ce que la question demande. Les mots CHAQUE et AUCUNE dans une question portent sur tous les éléments concernés : un seul contre-exemple suffit pour refuser.

4. Cinq verdicts possibles :
   - « direct » : ce qui est regardé établit par lui-même ce que la question demande ;
   - « partial » : il en établit une partie, pas tout ;
   - « unsupported » : il parle du sujet sans l'établir, ou n'en parle pas ;
   - « contradicted » : il établit le contraire ;
   - « ambiguous » : ce que tu as sous les yeux ne permet pas de trancher de façon fiable. Ce n'est pas une faute, mais donne la raison.

FORMAT DE RÉPONSE

Un objet JSON, rien d'autre : {"verdict": "direct|partial|unsupported|contradicted|ambiguous", "sentences": ["s1"], "reason": "une phrase courte"}. « sentences » est vide pour la portée « phrase seule » et « copie entière ».`;

/** The exact user message for one card. Never carries key material. */
export function renderVerifierCard(
  card: VerifierCard,
  question: string,
): string {
  const context = [
    card.frame ? `Consigne : ${card.frame}` : null,
    card.dossier ? `Dossier : ${card.dossier}` : null,
    !card.frame && !card.dossier
      ? 'Contexte : aucun, la question se juge sur la copie seule.'
      : null,
  ].filter((line): line is string => line !== null);
  let scope: string;
  let copy: string;
  if (singleSpan(card)) {
    const w = card.window ?? { end: card.response.length, start: 0 };
    const h = card.highlight;
    if (h.start < w.start || h.end > w.end) {
      throw new Error(`ATOM_VERIFIER_HIGHLIGHT_OUTSIDE_WINDOW ${card.cardId}`);
    }
    const marked = card.response.slice(h.start, h.end);
    const lead = marked.length - marked.trimStart().length;
    const trail = marked.length - marked.trimEnd().length;
    // The window is a character budget; it is trimmed inward to whole words
    // so the model never reads a fragment of a word at either edge.
    let before = card.response.slice(w.start, h.start + lead);
    if (w.start > 0 && !/^\s/u.test(before)) {
      const cut = before.search(/\s/u);
      before = cut === -1 ? '' : before.slice(cut);
    }
    let after = card.response.slice(h.end - trail, w.end);
    if (w.end < card.response.length && !/\s$/u.test(after)) {
      const cut = after.search(/\s\S*$/u);
      after = cut === -1 ? '' : after.slice(0, cut);
    }
    copy =
      (w.start > 0 ? '…' : '') +
      before +
      '⟦' +
      marked.trim() +
      '⟧' +
      after +
      (w.end < card.response.length ? ' …' : '');
    scope = 'la phrase marquée, prise seule';
  } else {
    copy = card.sentences
      .map((s) => `[${s.id}] ${card.response.slice(s.start, s.end).trim()}`)
      .join('\n');
    scope = wholeCopy(card)
      ? 'la copie entière'
      : 'la copie, en citant les phrases';
  }
  const text = [
    ...context,
    `Question : ${question}`,
    `Écriture pour la machine : ${card.atom} · ${card.atomId} · ${card.quantifier}`,
    `Portée : ${scope}`,
    'Copie :',
    copy,
  ].join('\n');
  assertBlind(text);
  return text;
}

const KEY_MARKERS = [
  '"member"',
  'citedFragment',
  'inPrimaryEndpoint',
  'lengthDiagnostic',
  'control_positive',
  'pairId',
  'adjudication-deck.v3.key',
];

/** Refuses any text that names a field of the key. */
export function assertBlind(text: string): void {
  for (const marker of KEY_MARKERS) {
    if (text.includes(marker)) {
      throw new Error(`ATOM_VERIFIER_PROMPT_CARRIES_THE_KEY ${marker}`);
    }
  }
}

export const VERIFIER_JSON_SCHEMA = {
  additionalProperties: false,
  properties: {
    reason: { maxLength: 400, type: 'string' },
    sentences: { items: { type: 'string' }, type: 'array' },
    verdict: { enum: [...VERIFIER_VERDICTS], type: 'string' },
  },
  required: ['verdict', 'sentences', 'reason'],
  type: 'object',
} as const;

export type ParsedVerifierAnswer = {
  reason: string;
  sentences: string[];
  verdict: VerifierVerdict;
};

/** Parses the model's content; a malformed answer is `null`, never a verdict. */
export function parseVerifierAnswer(
  content: string,
): ParsedVerifierAnswer | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    const match = /\{[\s\S]*\}/u.exec(content);
    if (!match) return null;
    try {
      raw = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const verdict = o.verdict;
  if (
    typeof verdict !== 'string' ||
    !(VERIFIER_VERDICTS as readonly string[]).includes(verdict)
  ) {
    return null;
  }
  const sentences = Array.isArray(o.sentences)
    ? o.sentences.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    reason: typeof o.reason === 'string' ? o.reason : '',
    sentences,
    verdict: verdict as VerifierVerdict,
  };
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
  reading: 'proceed' | 'narrow' | 'stop' | 'indeterminate';
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
}): ModelSummary {
  const byCard = new Map<string, (VerifierVerdict | null)[]>();
  let unparsed = 0;
  for (const o of input.observations) {
    const list = byCard.get(o.cardId) ?? [];
    list[o.repetition - 1] = o.verdict;
    byCard.set(o.cardId, list);
    if (o.verdict === null) unparsed += 1;
  }
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
  if (won < THRESHOLDS.pairwiseStop || flips > THRESHOLDS.flipsStop) {
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
  return {
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
