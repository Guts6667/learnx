/**
 * Audits the blind adjudication deck (V4.5-210, pass 1, v2).
 *
 * A blind pass is only blind if nothing on a card says which member it is, and
 * if nothing about the deck's shape says it either. This asserts both
 * mechanically, and measures the leaks it cannot remove instead of leaving them
 * unstated.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';

type Card = Record<string, unknown> & {
  argumentRoles: { bindable: boolean; description: string; roleId: string }[];
  candidateSpan: string;
  cardId: string;
  response: string;
  stratum: string;
  window: { end: number; start: number } | null;
};
type KeyEntry = {
  cardId: string;
  clusterId: string;
  member: 'control_positive' | 'negative' | 'positive';
  pairId: string | null;
  responseHash: string;
};

const FORBIDDEN_IDENTIFIERS = [
  'SENTENCE_DELETION',
  'FACT_INVERSION',
  'PARAGRAPH_SHUFFLE',
  'INJECTION_APPEND',
  'mutantId',
  'goldRationale',
  'expectedCriteria',
  'citedFragment',
  'responseHash',
  'clusterId',
  'openrouter',
  'sonnet',
  'kimi',
  'mistral',
  'gpt-',
  'claude-',
];
const FORBIDDEN_VERDICTS = [
  /\bDIRECT\b/,
  /\bNOT_DIRECT\b/,
  /\bAMBIGUOUS\b/,
  /\bmastered\b/,
  /"(?:member|isPositive|isNegative|control)"/,
];

/** P(a random positive is longer than a random negative); 0.5 is no signal. */
function auc(positives: number[], negatives: number[]): number {
  if (positives.length === 0 || negatives.length === 0) return Number.NaN;
  let wins = 0;
  let ties = 0;
  for (const a of positives) {
    for (const b of negatives) {
      if (a > b) wins += 1;
      else if (a === b) ties += 1;
    }
  }
  return (wins + 0.5 * ties) / (positives.length * negatives.length);
}

function main(): void {
  const deckPath = process.env.ADJUDICATION_DECK
    ? path.resolve(process.env.ADJUDICATION_DECK)
    : path.resolve(REG, 'adjudication-deck.v2.json');
  const deck = JSON.parse(readFileSync(deckPath, 'utf8')) as {
    cards: Card[];
    minimumGapTarget: { cluster: number; pair: number; response: number };
    windowCharacters: number;
  };
  const key = (
    JSON.parse(
      readFileSync(path.resolve(REG, 'adjudication-deck.v2.key.json'), 'utf8'),
    ) as { key: KeyEntry[] }
  ).key;

  const entryOf = new Map(key.map((entry) => [entry.cardId, entry]));
  const failures: string[] = [];
  const deckText = JSON.stringify(deck);

  // 1. The deck must not contain the key's linking fields.
  for (const entry of key) {
    if (entry.pairId && deckText.includes(entry.pairId)) {
      failures.push(`la paire ${entry.pairId} apparaît dans le paquet`);
      break;
    }
  }

  // 2. Forbidden tokens in metadata — learner and task text excepted, where a
  //    word like "direct" legitimately occurs.
  const CONTENT = [
    'candidateSpan',
    'dossier',
    'frame',
    'response',
    'sentences',
  ];
  for (const card of deck.cards) {
    const metadata = JSON.stringify(
      Object.fromEntries(
        Object.entries(card).filter(([field]) => !CONTENT.includes(field)),
      ),
    );
    for (const token of FORBIDDEN_IDENTIFIERS) {
      if (metadata.toLowerCase().includes(token.toLowerCase())) {
        failures.push(`${card.cardId} porte « ${token} » dans ses métadonnées`);
      }
    }
    for (const pattern of FORBIDDEN_VERDICTS) {
      if (pattern.test(metadata)) {
        failures.push(
          `${card.cardId} porte ${pattern.source} dans ses métadonnées`,
        );
      }
    }
  }

  // 3. Positive, negative and control cards must be indistinguishable in shape.
  //    The property is: knowing a card's field set must not narrow down which
  //    member it is. So every shape present must be carried by more than one
  //    member class — unless the whole deck shares one shape, which tells
  //    nothing either.
  const shape = (card: Card): string => Object.keys(card).sort().join(',');
  const membersByShape = new Map<string, Set<string>>();
  for (const card of deck.cards) {
    const set = membersByShape.get(shape(card)) ?? new Set<string>();
    set.add(entryOf.get(card.cardId)?.member ?? '?');
    membersByShape.set(shape(card), set);
  }
  if (membersByShape.size > 1) {
    for (const [fields, members] of membersByShape) {
      if (members.size === 1) {
        failures.push(
          `forme propre à « ${[...members][0]} » : ${fields.slice(0, 60)}…`,
        );
      }
    }
  }

  // 4. Roles must render as identifiers, not as objects.
  for (const card of deck.cards) {
    for (const role of card.argumentRoles) {
      if (typeof role.roleId !== 'string' || role.roleId.length === 0) {
        failures.push(`${card.cardId} porte un rôle sans identifiant`);
      }
    }
  }

  // 5. Every span locatable, every window containing its own span.
  for (const card of deck.cards) {
    if (!card.response.includes(card.candidateSpan)) {
      failures.push(`${card.cardId} : span absent de sa réponse`);
    }
    const start = card.response.indexOf(card.candidateSpan);
    if (
      card.window &&
      (card.window.start > start ||
        card.window.end < start + card.candidateSpan.length)
    ) {
      failures.push(`${card.cardId} : la fenêtre coupe son propre passage`);
    }
  }

  // 6. Gaps, recomputed from the delivered order rather than trusted.
  const achieved = { cluster: Infinity, pair: Infinity, response: Infinity };
  for (let i = 0; i < deck.cards.length; i += 1) {
    const a = entryOf.get(deck.cards[i]?.cardId ?? '');
    if (!a) continue;
    for (let j = i + 1; j < deck.cards.length; j += 1) {
      const b = entryOf.get(deck.cards[j]?.cardId ?? '');
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
  for (const field of ['cluster', 'pair', 'response'] as const) {
    if (achieved[field] < deck.minimumGapTarget[field]) {
      failures.push(
        `écart ${field} ${achieved[field]} sous la cible ${deck.minimumGapTarget[field]}`,
      );
    }
  }

  const isNegative = (card: Card) =>
    entryOf.get(card.cardId)?.member === 'negative';
  const visible = (card: Card) =>
    card.window ? card.window.end - card.window.start : card.response.length;
  const report = (label: string, cards: Card[]) => {
    const positives = cards.filter((card) => !isNegative(card));
    const negatives = cards.filter(isNegative);
    if (positives.length === 0 || negatives.length === 0) return;
    console.log(
      `  ${label.padEnd(34)} n=${String(cards.length).padStart(3)}  ` +
        `visible ${auc(positives.map(visible), negatives.map(visible)).toFixed(3)}  ` +
        `span ${auc(
          positives.map((c) => c.candidateSpan.length),
          negatives.map((c) => c.candidateSpan.length),
        ).toFixed(3)}`,
    );
  };

  console.log(`cartes : ${deck.cards.length}`);
  console.log(
    `écarts atteints : paire ${achieved.pair}, réponse ${achieved.response}, grappe ${achieved.cluster}`,
  );
  console.log('');
  console.log('AUC de longueur — 0,500 = aucun signal :');
  report('tout le paquet', deck.cards);
  report(
    'fenêtrées (S1–S3)',
    deck.cards.filter((card) => card.window),
  );
  report(
    '  dont fenêtre pleine',
    deck.cards.filter(
      (card) => card.window && visible(card) >= deck.windowCharacters,
    ),
  );
  report(
    '  dont réponse plus courte',
    deck.cards.filter(
      (card) => card.window && visible(card) < deck.windowCharacters,
    ),
  );
  report(
    'intégrales (S4–S7)',
    deck.cards.filter((card) => !card.window),
  );
  console.log('');

  if (failures.length > 0) {
    for (const failure of [...new Set(failures)])
      console.log(`ÉCHEC : ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('Aucune carte ne porte de marque de son membre.');
  console.log('');
  console.log('Fuites résiduelles, déclarées :');
  console.log(
    '  — la réponse complète d’une carte négative issue d’une suppression reste',
  );
  console.log(
    '    plus courte. La fenêtre l’annule là où elle est pleine ; ailleurs elle',
  );
  console.log('    subsiste, et l’ouverture volontaire est journalisée.');
  console.log(
    '  — sur S4–S7 la phrase citée par le correcteur est en moyenne plus longue',
  );
  console.log('    que la phrase porteuse : le signal existe, inversé.');
  console.log(
    '  — l’ordre est tiré d’une graine enregistrée : reproductible, pas secret.',
  );
}

main();
