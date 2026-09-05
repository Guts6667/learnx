/**
 * Injects deck v3, the blind pair file and the sealed questions into the
 * pass 2 page (V4.5-210): forced choice between the two members of a pair.
 * The key is never read; the build refuses a page carrying any of its words.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const template = readFileSync(
  path.resolve('scripts/templates/adjudication-pass2.v1.html'),
  'utf8',
);
const read = (f: string): string => readFileSync(path.resolve(REG, f), 'utf8');
const safe = (text: string): string => text.replace(/<\//g, '<\\/');
for (const slot of ['/*__DECK__*/', '/*__PAIRS__*/', '/*__QUESTIONS__*/']) {
  if (!template.includes(slot))
    throw new Error(`PASS2_TEMPLATE_MISSING ${slot}`);
}
const page = template
  .replace('/*__DECK__*/', safe(read('adjudication-deck.v3.json')))
  .replace('/*__PAIRS__*/', safe(read('adjudication-pairs.v1.json')))
  .replace('/*__QUESTIONS__*/', safe(read('plain-questions.v1.json')));
if (
  /adjudication-deck\.v3\.key|"member"|control_positive|citedFragment/u.test(
    page,
  )
) {
  throw new Error('PASS2_PAGE_CARRIES_THE_KEY');
}
const out = path.resolve(REG, 'adjudication-pass2.html');
writeFileSync(out, page);
console.log(`page écrite : ${out}`);
console.log(`taille      : ${(page.length / 1024).toFixed(0)} Ko`);
