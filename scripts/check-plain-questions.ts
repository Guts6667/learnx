/**
 * Checks the plain-French questions against the locked taxonomy (V4.5-210).
 *
 * Each question is the operational definition of its atom for a human. If it
 * drifts from the atom — a forall asked as an exists — the gold label answers a
 * different question from the measurement. This asserts: one question per
 * verifier atom, no question without an atom, the quantifier's word present,
 * and no question that names its expected answer.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REG = 'benchmarks/ai-correction/regression';
const file = process.argv[2] ?? 'plain-questions.v1.draft.json';

const taxonomy = JSON.parse(
  readFileSync(path.resolve(REG, 'criterion-atoms.v3_2_2.json'), 'utf8'),
) as {
  contentHash: string;
  criteria: Record<
    string,
    { atoms: { atomId: string; evaluator: string; quantifier: string }[] }
  >;
};
const draft = JSON.parse(readFileSync(path.resolve(REG, file), 'utf8')) as {
  atomTaxonomyHash: string;
  questions: Record<string, string>;
};

const failures: string[] = [];
if (draft.atomTaxonomyHash !== taxonomy.contentHash) {
  failures.push('empreinte de taxonomie différente');
}
const atoms = Object.values(taxonomy.criteria)
  .flatMap((c) => c.atoms)
  .filter((a) => a.evaluator === 'verifier');
for (const atom of atoms) {
  const q = draft.questions[atom.atomId];
  if (!q) {
    failures.push(`${atom.atomId} : aucune question`);
    continue;
  }
  const upper = q;
  const forallWord = upper.includes('CHAQUE') || upper.includes('EVERY');
  const noneWord = upper.includes('AUCUN') || /\bNO\b/u.test(upper);
  if (
    (atom.quantifier === 'forall' || atom.quantifier === 'forall_exists') &&
    !forallWord
  ) {
    failures.push(
      `${atom.atomId} (${atom.quantifier}) : « CHAQUE » / « EVERY » absent`,
    );
  }
  if (atom.quantifier === 'not_exists' && !noneWord) {
    failures.push(`${atom.atomId} (not_exists) : « AUCUNE » / « NO » absent`);
  }
  if (atom.quantifier === 'exists' && (forallWord || noneWord)) {
    failures.push(
      `${atom.atomId} (exists) : porte un mot de forall / not_exists`,
    );
  }
  if (!q.trim().endsWith('?'))
    failures.push(`${atom.atomId} : pas une question`);
  if (/\b(oui|non|yes)\b/iu.test(q.replace(/n[’']/gu, ''))) {
    failures.push(`${atom.atomId} : contient « oui » ou « non »`);
  }
}
for (const atomId of Object.keys(draft.questions)) {
  if (!atoms.some((a) => a.atomId === atomId))
    failures.push(`${atomId} : question sans atome vérificateur`);
}
console.log(
  `atomes vérificateur : ${atoms.length} · questions : ${Object.keys(draft.questions).length}`,
);
if (failures.length) {
  for (const f of failures) console.log(`ÉCHEC : ${f}`);
  process.exitCode = 1;
} else {
  console.log(
    'Appariement un-à-un, quantificateurs couverts, aucune réponse soufflée.',
  );
}
