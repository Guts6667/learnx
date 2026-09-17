/**
 * Builds the paste pack for V4.5-210: the 106 blind cards as plain text, in
 * batches, with the prompt that goes with them, to hand to any chat model by
 * copy-paste.
 *
 * This is the exploratory format. What a chat interface runs behind the box
 * (settings, hidden instructions) is unknown and not replayable, so answers
 * gathered this way are reported apart from the measured API run. The pack
 * shows exactly what the human page shows for the same card — the question,
 * the examined sentence, the excerpt or the whole copy, the frame or dossier
 * when the card has one — and never the key.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const OUT = path.resolve(REG, 'paste-pack.v1');
const CARDS_PER_BATCH = 10;

type Sentence = { end: number; id: string; start: number };
type Card = {
  atom: string;
  atomId: string;
  candidateSentenceIds: string[];
  cardId: string;
  dossier?: string;
  frame?: string;
  highlight: { end: number; start: number };
  quantifier: string;
  response: string;
  sentences: Sentence[];
  stratum: string;
  window: { end: number; start: number } | null;
};
type Deck = { cards: Card[]; manifestHash: string };
type Questions = { contentHash: string; questions: Record<string, string> };

const deckRaw = readFileSync(
  path.resolve(REG, 'adjudication-deck.v3.json'),
  'utf8',
);
const questionsRaw = readFileSync(
  path.resolve(REG, 'plain-questions.v1.json'),
  'utf8',
);
const deck = JSON.parse(deckRaw) as Deck;
const questions = JSON.parse(questionsRaw) as Questions;

const singleSpan = (card: Card): boolean => /^S[123]_/u.test(card.stratum);
const wholeCopy = (card: Card): boolean => card.stratum.startsWith('S7');

const PROMPT = `Tu relis des copies d'élèves à l'aveugle. Pour chaque carte, une seule question, en français, à propos d'un extrait de copie. Tu ne sais rien d'autre : ni le barème, ni la note, ni ce que d'autres ont répondu.

RÈGLES

1. Réponds avec ce que la carte te laisse regarder, rien d'autre. N'utilise pas de connaissances extérieures et ne suppose rien qui n'est pas écrit. Quand une consigne ou un dossier sont donnés, ils servent à comprendre ; la réponse porte sur la copie.

2. La portée est indiquée sur chaque carte :
   - « la phrase marquée, prise seule » : la réponse porte uniquement sur la phrase entre ⟦ et ⟧. Le reste de l'extrait sert à comprendre, il ne compte pas. Si ta réponse ne tient que grâce à une autre phrase, réponds NON ou INDÉCIS, et signale-le dans « autre ».
   - « la copie, en citant les phrases » : la réponse porte sur la copie entière ; cite, par leur numéro, les phrases qui te font répondre : une phrase par chose concernée (par exemple une pour la donnée, une pour le choix), jamais toutes.
   - « la copie entière » : la réponse porte sur toute la copie, sans citation.

3. Trois réponses possibles : OUI, NON, INDÉCIS. INDÉCIS veut dire que ce que tu as sous les yeux ne permet pas de trancher de façon fiable. Ce n'est pas une faute, mais donne la raison.

4. Une phrase qui parle du bon sujet n'est pas forcément la preuve. Ne réponds OUI que si la phrase, ou les phrases citées, établissent par elles-mêmes ce que la question demande. Les mots CHAQUE et AUCUNE dans une question portent sur tous les éléments concernés : un seul contre-exemple suffit pour répondre NON.

5. « autre », seulement pour la portée « phrase seule » : si on retirait la phrase marquée, une autre phrase de l'extrait suffirait-elle, seule, à répondre OUI ? Réponds OUI ou NON. Pour les autres portées, mets « - ».

FORMAT DE RÉPONSE

Strict : une ligne par carte, dans l'ordre des cartes, sans aucun autre texte avant, entre ou après.

C-identifiant | OUI ou NON ou INDÉCIS | phrases: s1,s3 ou - | autre: OUI ou NON ou - | raison: une phrase courte

Exemple :
C-0000000000 | NON | phrases: - | autre: OUI | raison: la phrase constate un problème sans rien proposer ; la phrase suivante propose.

LES CARTES
`;

function renderCard(card: Card, index: number): string {
  const question = questions.questions[card.atomId] ?? card.atom;
  const context = [
    card.frame ? `Consigne : ${card.frame}` : null,
    card.dossier ? `Dossier : ${card.dossier}` : null,
    !card.frame && !card.dossier
      ? 'Contexte : aucun, la question se juge sur la copie seule.'
      : null,
  ].filter(Boolean);
  let scope: string;
  let copy: string;
  if (singleSpan(card)) {
    const w = card.window ?? { end: card.response.length, start: 0 };
    const h = card.highlight;
    if (h.start < w.start || h.end > w.end) {
      throw new Error(`PASTE_PACK_HIGHLIGHT_OUTSIDE_WINDOW ${card.cardId}`);
    }
    // Sentence spans carry their surrounding blanks: keep them outside the marks.
    const marked = card.response.slice(h.start, h.end);
    const lead = marked.length - marked.trimStart().length;
    const trail = marked.length - marked.trimEnd().length;
    copy =
      (w.start > 0 ? '… ' : '') +
      card.response.slice(w.start, h.start + lead) +
      '⟦' +
      marked.trim() +
      '⟧' +
      card.response.slice(h.end - trail, w.end) +
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
  return [
    `### Carte ${index + 1} · ${card.cardId}`,
    ...context,
    `Question : ${question}`,
    `Écriture pour la machine : ${card.atom} · ${card.atomId} · ${card.quantifier}`,
    `Portée : ${scope}`,
    'Copie :',
    copy,
    '',
  ].join('\n');
}

const sha = (text: string): string =>
  'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');

mkdirSync(OUT, { recursive: true });
const batches: { cardIds: string[]; file: string; hash: string }[] = [];
for (let i = 0; i < deck.cards.length; i += CARDS_PER_BATCH) {
  const cards = deck.cards.slice(i, i + CARDS_PER_BATCH);
  const n = String(batches.length + 1).padStart(2, '0');
  const file = `batch-${n}.txt`;
  const body =
    PROMPT +
    '\n' +
    cards.map((c, k) => renderCard(c, i + k)).join('\n') +
    `\nFin du lot ${n} : ${cards.length} cartes. Réponds maintenant, ${cards.length} lignes.\n`;
  if (
    body.includes('adjudication-deck.v3.key') ||
    body.includes('lengthDiagnostic')
  ) {
    throw new Error('PASTE_PACK_CARRIES_THE_KEY');
  }
  writeFileSync(path.join(OUT, file), body);
  batches.push({ cardIds: cards.map((c) => c.cardId), file, hash: sha(body) });
}
const covered = new Set(batches.flatMap((b) => b.cardIds));
if (covered.size !== deck.cards.length) {
  throw new Error('PASTE_PACK_DOES_NOT_COVER_THE_DECK');
}

const manifest = {
  batches,
  cardsPerBatch: CARDS_PER_BATCH,
  deckHash: deck.manifestHash,
  format:
    'C-identifiant | OUI/NON/INDÉCIS | phrases: <ids ou -> | autre: OUI/NON/- | raison: <texte>',
  promptHash: sha(PROMPT),
  purpose: 'exploratory',
  questionsHash: questions.contentHash,
  schemaVersion: 1,
  totalCards: deck.cards.length,
};
writeFileSync(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);

const readme = `# Paquet à coller — V4.5-210, passe 1 (exploratoire)

Les 106 cartes de la relecture à l'aveugle, en texte, par lots de ${CARDS_PER_BATCH},
avec la consigne qui va avec. À coller tel quel dans une IA de discussion.

## Comment faire passer le test à un modèle

1. Une conversation neuve par lot. Ne pas enchaîner deux lots dans la même
   conversation : le modèle se souviendrait du précédent.
2. Coller le contenu complet d'un fichier \`batch-NN.txt\`, sans rien ajouter
   avant ni après, sans consigne personnelle.
3. Garder la première réponse. Ne pas relancer, ne pas demander de corriger,
   ne pas discuter. Si le modèle ne respecte pas le format, garder quand même
   sa réponse telle quelle.
4. Enregistrer la réponse mot pour mot dans
   \`answers/<modele>/batch-NN.txt\`, un dossier par modèle, avec à côté un
   fichier \`answers/<modele>/RUN.md\` qui note : le nom exact du modèle et sa
   version si l'interface l'affiche, l'interface utilisée (site, application),
   la date, et tout réglage visible.

## Ce que ça vaut

C'est un format exploratoire. Une interface de discussion peut ajouter ses
propres instructions, changer de réglages sans le dire, et rien n'est
rejouable. Les réponses recueillies ainsi sont rapportées à part de la mesure
officielle, qui passe par l'accès direct aux modèles, avec réglages
enregistrés et trois répétitions.

## Empreintes

Paquet de cartes : \`${deck.manifestHash}\`. Questions : \`${questions.contentHash}\`.
Chaque lot a son empreinte dans \`manifest.json\` : un lot modifié ne sera pas
accepté à la comparaison.
`;
writeFileSync(path.join(OUT, 'README.md'), readme);

console.log(`paquet écrit : ${OUT}`);
console.log(
  `lots         : ${batches.length} (${CARDS_PER_BATCH} cartes par lot)`,
);
console.log(`cartes       : ${covered.size}`);
