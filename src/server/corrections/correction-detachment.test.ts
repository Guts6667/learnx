import { describe, expect, it } from 'vitest';

import {
  collectEvidenceQuotes,
  planDetachment,
  stripEvidenceQuotes,
  type DetachableCorrection,
} from './correction-detachment';

const AT = new Date('2026-08-31T14:37:52.123Z');

function correction(
  overrides: Partial<DetachableCorrection> = {},
): DetachableCorrection {
  return {
    activityType: 'writing',
    attempts: [
      {
        id: 'attempt-1',
        rawOutput: { content: 'brut' },
        // La tentative porte sa propre copie du jugement (V4.5-217).
        structuredResult: {
          criteria: [{ evidenceQuotes: ['j’ai écrit ceci'], key: 'clarity' }],
        },
      },
      { id: 'attempt-2', rawOutput: null, structuredResult: null },
    ],
    id: 'correction-1',
    modelId: 'anthropic/claude-sonnet-4.6',
    promptSnapshot: { system: '…', user: 'ma production' },
    promptVersion: '2.2.0',
    reuseConsent: true,
    structuredResult: {
      criteria: [
        {
          confidence: 0.8,
          evidenceQuotes: ['j’ai écrit ceci'],
          key: 'clarity',
          level: 'MASTERED',
        },
        { confidence: 0.4, evidenceQuotes: [], key: 'facts', level: 'ABSENT' },
      ],
    },
    submissionSnapshot: { text: 'ma production' },
    ...overrides,
  };
}

describe('détachement d’une correction (V4.5-168)', () => {
  it('retire les citations sans toucher au jugement', () => {
    // What stays is the shape of the judgement; what goes is the learner's own
    // words, quoted back at them.
    const plan = planDetachment(correction(), () => 'pseudo-1', AT);

    expect(plan.structuredResult).toEqual({
      criteria: [
        {
          confidence: 0.8,
          evidenceQuotes: [],
          key: 'clarity',
          level: 'MASTERED',
        },
        { confidence: 0.4, evidenceQuotes: [], key: 'facts', level: 'ABSENT' },
      ],
    });
  });

  it('vide les citations où qu’elles soient, sans connaître le contrat', () => {
    // The correction contract has three variants today and will have more. A
    // walker typed against one of them leaves a learner's words behind the day
    // a fourth appears — in a row we have told them was detached.
    expect(
      stripEvidenceQuotes({
        a: { b: [{ evidenceQuotes: ['x'] }] },
        evidenceQuotes: ['y'],
      }),
    ).toEqual({ a: { b: [{ evidenceQuotes: [] }] }, evidenceQuotes: [] });
  });

  it('emporte les citations dans l’échantillon plutôt que de les perdre', () => {
    const plan = planDetachment(correction(), () => 'pseudo-1', AT);

    expect(collectEvidenceQuotes(correction().structuredResult)).toEqual([
      ['j’ai écrit ceci'],
      [],
    ]);
    expect(plan.sample?.evidenceQuotes).toEqual([['j’ai écrit ceci'], []]);
  });

  it('ne date l’échantillon qu’au jour', () => {
    // A precise second, lined up against an application log, would say who was
    // writing then.
    const plan = planDetachment(correction(), () => 'pseudo-1', AT);

    expect(plan.sample?.detachedOn.toISOString()).toBe(
      '2026-08-31T00:00:00.000Z',
    );
  });

  it('n’écrit aucun échantillon sans consentement, et détache quand même', () => {
    // Consent decides what survives for research, never whether the learner is
    // detached.
    const plan = planDetachment(
      correction({ reuseConsent: false }),
      () => 'pseudo-1',
      AT,
    );

    expect(plan.sample).toBeNull();
    expect(plan.structuredResult).toEqual({
      criteria: [
        {
          confidence: 0.8,
          evidenceQuotes: [],
          key: 'clarity',
          level: 'MASTERED',
        },
        { confidence: 0.4, evidenceQuotes: [], key: 'facts', level: 'ABSENT' },
      ],
    });
    expect(plan.attempts.map((attempt) => attempt.id)).toEqual(['attempt-1']);
  });

  it('ne porte aucun lien vers la correction ni vers le compte', () => {
    // The irreversibility is the draw, not a rule in code a later change could
    // undo. Nothing in the sample points back.
    const plan = planDetachment(correction(), () => 'pseudo-1', AT);

    expect(Object.keys(plan.sample ?? {})).not.toContain('correctionId');
    expect(Object.keys(plan.sample ?? {})).not.toContain('userId');
    expect(JSON.stringify(plan.sample)).not.toContain('correction-1');
  });

  it('ne réécrit que les tentatives qui portent encore quelque chose', () => {
    const plan = planDetachment(correction(), () => 'pseudo-1', AT);
    expect(plan.attempts.map((attempt) => attempt.id)).toEqual(['attempt-1']);
  });

  it('retire aussi les citations du jugement propre à la tentative', () => {
    // V4.5-217. La correction était détachée et les mots de l'apprenant
    // restaient à côté, dans la ligne qui l'a produite : le détachement ne
    // lisait que `rawOutput`. Une correction dont on a retiré les citations
    // pendant que sa tentative les garde n'est pas détachée, elle en a l'air.
    const plan = planDetachment(correction(), () => 'pseudo-1', AT);

    expect(plan.attempts[0]?.structuredResult).toEqual({
      criteria: [{ evidenceQuotes: [], key: 'clarity' }],
    });
  });

  it('retire les citations de la tentative même sans consentement', () => {
    // Le consentement décide de ce qui SURVIT dans l'échantillon, jamais de ce
    // qui est retiré de la correction : les deux branches retirent les mêmes
    // mots des mêmes lignes.
    const plan = planDetachment(
      correction({ reuseConsent: false }),
      () => 'pseudo-1',
      AT,
    );

    expect(plan.sample).toBeNull();
    expect(plan.attempts[0]?.structuredResult).toEqual({
      criteria: [{ evidenceQuotes: [], key: 'clarity' }],
    });
  });

  it('inclut une tentative qui n’a qu’un jugement, sans sortie brute', () => {
    // Filtrer sur `rawOutput` seul la laissait dehors avec ses citations.
    const plan = planDetachment(
      correction({
        attempts: [
          {
            id: 'attempt-3',
            rawOutput: null,
            structuredResult: {
              criteria: [{ evidenceQuotes: ['encore mes mots'] }],
            },
          },
        ],
      }),
      () => 'pseudo-1',
      AT,
    );

    expect(plan.attempts).toEqual([
      {
        id: 'attempt-3',
        structuredResult: { criteria: [{ evidenceQuotes: [] }] },
      },
    ]);
  });
});
