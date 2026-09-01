/**
 * Audits the blind adjudication deck (V4.5-210, pass 1).
 *
 * A blind pass is only blind if nothing on a card says which member it is.
 * This asserts that mechanically rather than by reading the builder, and
 * reports the leaks it cannot remove instead of leaving them unstated.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';

type Card = Record<string, unknown> & {
  candidateSpan: string;
  cardId: string;
  response: string;
};

/**
 * Anything that would name the member, the model, or the expected outcome.
 *
 * Two lists, because they need different matching. Identifiers are machine
 * tokens and never appear in rubric French, so a substring match is right.
 * Verdict labels are matched on word boundaries and in their exact case: the
 * rubric legitimately says « directement actionnable », and treating that as a
 * leak would be a false alarm that teaches us to ignore the audit.
 */
const FORBIDDEN_IDENTIFIERS = [
  'SENTENCE_DELETION',
  'FACT_INVERSION',
  'PARAGRAPH_SHUFFLE',
  'INJECTION_APPEND',
  'mutantId',
  'goldRationale',
  'expectedCriteria',
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
  /\bnot_mastered\b/,
  /"(?:member|isPositive|isNegative)"/,
];

function main(): void {
  const deckPath = process.env.ADJUDICATION_DECK
    ? path.resolve(process.env.ADJUDICATION_DECK)
    : path.resolve(REG, 'adjudication-deck.v1.json');
  const deck = JSON.parse(readFileSync(deckPath, 'utf8')) as {
    cards: Card[];
    minimumGap: number;
  };
  const key = JSON.parse(
    readFileSync(path.resolve(REG, 'adjudication-deck.v1.key.json'), 'utf8'),
  ) as {
    key: { cardId: string; member: 'negative' | 'positive'; pairId: string }[];
  };

  const memberOf = new Map(key.key.map((k) => [k.cardId, k.member]));
  const pairOf = new Map(key.key.map((k) => [k.cardId, k.pairId]));
  const failures: string[] = [];

  // 1. The deck must not contain the key.
  const deckText = JSON.stringify(deck);
  for (const entry of key.key) {
    if (deckText.includes(entry.pairId)) {
      failures.push(`la paire ${entry.pairId} apparaît dans le paquet`);
      break;
    }
  }

  // 2. Forbidden tokens, ignoring the response and dossier — those are learner
  //    and task text, where a word like "positive" can legitimately occur.
  for (const card of deck.cards) {
    const metadata = JSON.stringify(
      Object.fromEntries(
        Object.entries(card).filter(
          ([field]) =>
            !['dossier', 'frame', 'response', 'candidateSpan'].includes(field),
        ),
      ),
    ).toLowerCase();
    for (const token of FORBIDDEN_IDENTIFIERS) {
      if (metadata.includes(token.toLowerCase())) {
        failures.push(`${card.cardId} porte « ${token} » dans ses métadonnées`);
      }
    }
    const rawMetadata = JSON.stringify(
      Object.fromEntries(
        Object.entries(card).filter(
          ([field]) =>
            !['dossier', 'frame', 'response', 'candidateSpan'].includes(field),
        ),
      ),
    );
    for (const pattern of FORBIDDEN_VERDICTS) {
      if (pattern.test(rawMetadata)) {
        failures.push(
          `${card.cardId} porte ${pattern.source} dans ses métadonnées`,
        );
      }
    }
  }

  // 3. Positive and negative cards must be structurally indistinguishable.
  const shape = (card: Card): string => Object.keys(card).sort().join(',');
  const shapesByMember = new Map<string, Set<string>>();
  for (const card of deck.cards) {
    const member = memberOf.get(card.cardId) ?? '?';
    const set = shapesByMember.get(member) ?? new Set<string>();
    set.add(shape(card));
    shapesByMember.set(member, set);
  }
  const positiveShapes = [...(shapesByMember.get('positive') ?? [])].sort();
  const negativeShapes = [...(shapesByMember.get('negative') ?? [])].sort();
  const onlyPositive = positiveShapes.filter(
    (s) => !negativeShapes.includes(s),
  );
  const onlyNegative = negativeShapes.filter(
    (s) => !positiveShapes.includes(s),
  );
  if (onlyPositive.length > 0 || onlyNegative.length > 0) {
    failures.push(
      `forme de carte distinctive : ${onlyPositive.length} propre aux positifs, ${onlyNegative.length} propre aux négatifs`,
    );
  }

  // 4. Every card's span must be locatable in its own response.
  const unlocatable = deck.cards.filter(
    (card) => !card.response.includes(card.candidateSpan),
  );
  if (unlocatable.length > 0) {
    failures.push(
      `${unlocatable.length} cartes dont le span est absent de leur réponse`,
    );
  }

  // 5. Minimum gap, recomputed rather than trusted.
  const position = new Map(
    deck.cards.map((card, index) => [card.cardId, index]),
  );
  let minimumGap = Number.POSITIVE_INFINITY;
  for (const card of deck.cards) {
    const twin = deck.cards.find(
      (other) =>
        other.cardId !== card.cardId &&
        pairOf.get(other.cardId) === pairOf.get(card.cardId),
    );
    if (!twin) continue;
    minimumGap = Math.min(
      minimumGap,
      Math.abs(
        (position.get(card.cardId) ?? 0) - (position.get(twin.cardId) ?? 0),
      ),
    );
  }
  if (minimumGap < deck.minimumGap) {
    failures.push(
      `écart minimum ${minimumGap} sous le seuil ${deck.minimumGap}`,
    );
  }

  // Residual, reported not asserted: how far apart the two members read.
  const positives = deck.cards.filter(
    (c) => memberOf.get(c.cardId) === 'positive',
  );
  const negatives = deck.cards.filter(
    (c) => memberOf.get(c.cardId) === 'negative',
  );
  const stat = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      max: sorted.at(-1) ?? 0,
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      min: sorted[0] ?? 0,
    };
  };
  const spanP = stat(positives.map((c) => c.candidateSpan.length));
  const spanN = stat(negatives.map((c) => c.candidateSpan.length));
  const respP = stat(positives.map((c) => c.response.length));
  const respN = stat(negatives.map((c) => c.response.length));

  console.log(
    `cartes : ${deck.cards.length}  écart minimum recalculé : ${minimumGap}`,
  );
  console.log(
    `longueur du span      — positifs ${spanP.min}/${spanP.median}/${spanP.max}, négatifs ${spanN.min}/${spanN.median}/${spanN.max}  (min/médiane/max)`,
  );
  console.log(
    `longueur de la réponse — positifs ${respP.min}/${respP.median}/${respP.max}, négatifs ${respN.min}/${respN.median}/${respN.max}`,
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
  console.log('Fuites résiduelles, déclarées et non corrigées :');
  console.log(
    '  — la réponse d’une carte négative issue d’une suppression de phrase est',
  );
  console.log(
    '    plus courte d’une phrase que celle de sa jumelle. Un relecteur qui',
  );
  console.log(
    '    reconnaît la copie et se souvient de l’autre carte peut le remarquer.',
  );
  console.log(
    `    L’écart minimum de ${deck.minimumGap} cartes atténue sans supprimer.`,
  );
  console.log(
    '  — l’ordre est tiré d’une graine enregistrée, donc reproductible : il',
  );
  console.log('    n’a pas été choisi après coup, mais il n’est pas secret.');
}

main();
