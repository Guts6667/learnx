import { describe, expect, it } from 'vitest';

import {
  checkQuotedArithmetic,
  computationsIn,
} from './ai-correction-quoted-arithmetic.js';

describe('arithmetic a quote states explicitly', () => {
  it('catches the claim the verifier certified at 0.97 confidence', () => {
    // The production failure, verbatim. The corrector quoted this line and
    // wrote "les deux calculs sont corrects"; the verifier agreed. A
    // calculator does not.
    const [first, second] = computationsIn(
      'Cobalt revient à 7 × 6 € + 12 € = 44 € ; Dune à 7 × 5 € + 10 € = 45 €.',
    );

    expect(first?.computed).toBe(54);
    expect(first?.stated).toBe(44);
    expect(first?.holds).toBe(false);
    // And the sound half of the same sentence is left alone.
    expect(second?.holds).toBe(true);
  });

  it('reads the narrow spaces the French corpora group digits with', () => {
    // Without this the expression does not parse at all, and the check reports
    // a clean run over text it never read.
    const [computation] = computationsIn('1\u202F200 + 850 = 2\u202F050');

    expect(computation?.computed).toBe(2050);
    expect(computation?.holds).toBe(true);
  });

  it('binds multiplication tighter than addition', () => {
    const [computation] = computationsIn('4 × 8 + 4 = 36');

    expect(computation?.computed).toBe(36);
    expect(computation?.holds).toBe(true);
  });

  it('treats a difference under half a cent as rounding, not a false claim', () => {
    const [computation] = computationsIn('6 × 4,50 + 9 = 36,001');

    expect(computation?.holds).toBe(true);
  });

  it('leaves prose arithmetic out of scope rather than half-reading it', () => {
    // "trois étapes de 45 minutes, soit 2 heures" is a real falsehood and a
    // language problem. Guessing at it would trade a check that cannot be wrong
    // for one that sometimes is.
    expect(
      computationsIn('Trois étapes de 45 minutes chacune, soit 2 heures.'),
    ).toEqual([]);
    expect(
      computationsIn('Sur 40 dossiers, 12 refusés, soit un taux de 25 %.'),
    ).toEqual([]);
  });

  it('reports how little it covers alongside what it found', () => {
    const report = checkQuotedArithmetic([
      'Cobalt revient à 7 × 6 € + 12 € = 44 €.',
      'Les erreurs ont baissé après le changement de disposition.',
      'Le sponsor n’a fixé aucune contrainte de qualité.',
    ]);

    expect(report.violations).toHaveLength(1);
    // A check whose scope is a fraction of the quotes must say so, or a clean
    // report reads as a verdict on arithmetic it never examined.
    expect(report.coverage).toEqual({ quotesInScope: 1, quotesTotal: 3 });
  });
});
