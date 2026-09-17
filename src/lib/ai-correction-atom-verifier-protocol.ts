/** Versioned atom-verifier prompts and strict output shape; no transport or scoring. */
const VERIFIER_VERDICTS = [
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
  if (
    typeof o.reason !== 'string' ||
    o.reason.length > 400 ||
    !Array.isArray(o.sentences) ||
    !o.sentences.every((s) => typeof s === 'string') ||
    Object.keys(o).some((k) => !['verdict', 'sentences', 'reason'].includes(k))
  )
    return null;
  return {
    reason: o.reason,
    sentences: o.sentences as string[],
    verdict: verdict as VerifierVerdict,
  };
}
