/**
 * Injects the sealed deck into the adjudication page (V4.5-210, pass 1).
 *
 * The page is a build output, never hand-edited: it must always carry the deck
 * it claims to carry. The key file is deliberately not injected — a page that
 * knows which member a card is would not be blind.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const template = readFileSync(
  path.resolve('scripts/templates/adjudication-pass1.v5.html'),
  'utf8',
);
const deck = readFileSync(
  path.resolve(REG, 'adjudication-deck.v3.json'),
  'utf8',
);

if (!template.includes('/*__DECK__*/')) {
  throw new Error('ADJUDICATION_TEMPLATE_MISSING_DECK_SLOT');
}
const questionsFile = process.env.PLAIN_QUESTIONS ?? 'plain-questions.v1.json';
const questions = readFileSync(path.resolve(REG, questionsFile), 'utf8');
if (!template.includes('/*__QUESTIONS__*/')) {
  throw new Error('ADJUDICATION_TEMPLATE_MISSING_QUESTIONS_SLOT');
}
const questionsEn = readFileSync(
  path.resolve(
    REG,
    process.env.PLAIN_QUESTIONS_EN ?? 'plain-questions.en.v1.draft.json',
  ),
  'utf8',
);
const slicesV1 = JSON.parse(
  readFileSync(path.resolve(REG, 'adjudication-slices.v1.json'), 'utf8'),
) as { contentHash: string; slices: Record<string, unknown>[] };
// Extra slices (test-retest) live in their own sealed file; each carries the
// hash of the file it comes from, so an export says where its slice came from.
const retestPath = path.resolve(REG, 'adjudication-retest.v1.json');
const retest = existsSync(retestPath)
  ? (JSON.parse(readFileSync(retestPath, 'utf8')) as {
      contentHash: string;
      slices: Record<string, unknown>[];
    })
  : null;
const slices = JSON.stringify({
  ...slicesV1,
  slices: [
    ...slicesV1.slices.map((x) => ({ ...x, sourceHash: slicesV1.contentHash })),
    ...(retest
      ? retest.slices.map((x) => ({ ...x, sourceHash: retest.contentHash }))
      : []),
  ],
});
const safe = (text: string) => text.replace(/<\//g, '<\\/');
const page = template
  .replace('/*__DECK__*/', safe(deck))
  .replace('/*__QUESTIONS__*/', safe(questions))
  .replace('/*__QUESTIONS_EN__*/', safe(questionsEn))
  .replace('/*__SLICES__*/', safe(slices));
if (page.includes('adjudication-deck.v3.key')) {
  throw new Error('ADJUDICATION_PAGE_CARRIES_THE_KEY');
}
const out = path.resolve(REG, 'adjudication-pass1.html');
writeFileSync(out, page);
console.log(`page écrite : ${out}`);
console.log(`taille      : ${(page.length / 1024).toFixed(0)} Ko`);
console.log(
  `cartes      : ${(JSON.parse(deck) as { cards: unknown[] }).cards.length}`,
);
