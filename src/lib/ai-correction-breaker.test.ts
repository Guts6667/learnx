import {
  BREAKER_THRESHOLDS,
  BREAKER_WINDOW_SIZE,
  BREAKER_WRONG_AT_HIGH_QUORUM,
  breakerRates,
  breakerTripReason,
  type BreakerObservations,
} from './ai-correction-breaker';

function observations(
  overrides: Partial<BreakerObservations> = {},
): BreakerObservations {
  return {
    checkerDisagreed: 0,
    highCriteriaVoted: 0,
    highCriteriaVotedWrong: 0,
    unusable: 0,
    windowObserved: BREAKER_WINDOW_SIZE,
    ...overrides,
  };
}

describe('breakerRates', () => {
  it('renvoie null sous le quorum plutôt que zéro', () => {
    // Zero reads as health. Null reads as "not enough data", which is what an
    // empty window actually means.
    expect(breakerRates(observations({ windowObserved: 49 }))).toEqual({
      checkerDisagreement: null,
      unusable: null,
      wrongAtHigh: null,
    });
  });

  it('mesure dès que la fenêtre est pleine', () => {
    expect(
      breakerRates(observations({ checkerDisagreed: 10, unusable: 1 })),
    ).toMatchObject({ checkerDisagreement: 0.2, unusable: 0.02 });
  });

  it('compte le quorum apprenant en critères votés, pas en corrections', () => {
    const belowQuorum = breakerRates(
      observations({
        highCriteriaVoted: BREAKER_WRONG_AT_HIGH_QUORUM - 1,
        highCriteriaVotedWrong: 19,
      }),
    );
    expect(belowQuorum.wrongAtHigh).toBeNull();

    const atQuorum = breakerRates(
      observations({
        highCriteriaVoted: BREAKER_WRONG_AT_HIGH_QUORUM,
        highCriteriaVotedWrong: 4,
      }),
    );
    expect(atQuorum.wrongAtHigh).toBe(0.2);
  });
});

describe('breakerTripReason', () => {
  it('ne déclenche rien sans données', () => {
    expect(
      breakerTripReason({
        checkerDisagreement: null,
        unusable: null,
        wrongAtHigh: null,
      }),
    ).toBeNull();
  });

  it('reste inerte à volume nul, même avec des seuils armés', () => {
    // The learner rule exists in code from day one and cannot fire before the
    // votes do. Nobody has to remember to come back and arm it.
    expect(
      breakerTripReason(
        breakerRates(
          observations({ highCriteriaVoted: 0, highCriteriaVotedWrong: 0 }),
        ),
      ),
    ).toBeNull();
  });

  it.each([
    [
      'désaccord du vérificateur',
      { checkerDisagreement: 0.41 },
      'CHECKER_DISAGREEMENT',
    ],
    ['corrections inutilisables', { unusable: 0.051 }, 'UNUSABLE_RATE'],
    [
      'contradiction apprenant en confiance haute',
      { wrongAtHigh: 0.11 },
      'LEARNER_CONTRADICTION_AT_HIGH',
    ],
  ])('déclenche sur %s', (_label, rates, expected) => {
    expect(
      breakerTripReason({
        checkerDisagreement: null,
        unusable: null,
        wrongAtHigh: null,
        ...rates,
      }),
    ).toBe(expected);
  });

  it.each([
    ['checkerDisagreement', BREAKER_THRESHOLDS.checkerDisagreement],
    ['unusable', BREAKER_THRESHOLDS.unusable],
    ['wrongAtHigh', BREAKER_THRESHOLDS.wrongAtHigh],
  ])('ne déclenche pas exactement au seuil de %s', (key, threshold) => {
    // The contract says "greater than", so the threshold itself is allowed.
    // Pinned because an inclusive comparison here would trip the guardrail on
    // a rate the contract calls acceptable.
    expect(
      breakerTripReason({
        checkerDisagreement: null,
        unusable: null,
        wrongAtHigh: null,
        [key]: threshold,
      }),
    ).toBeNull();
  });

  it('retient la cause fournisseur quand plusieurs franchissent', () => {
    // Not arbitrary: a supplier degradation explains learner contradictions
    // downstream of it, so recording the learner reason would name a symptom.
    expect(
      breakerTripReason({
        checkerDisagreement: 0.9,
        unusable: 0.9,
        wrongAtHigh: 0.9,
      }),
    ).toBe('CHECKER_DISAGREEMENT');
  });
});
