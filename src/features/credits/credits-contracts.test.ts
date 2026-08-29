import * as z from 'zod/mini';

import {
  correctionMonitoringSummarySchema,
  correctionReleasePreflightSchema,
  creditMemberPageSchema,
} from '@/features/credits/credits-contracts';

/**
 * Les fixtures des tests de page décrivent ce que le serveur est censé
 * renvoyer. Rien ne le vérifiait : en V4.5-140, les trois fixtures de
 * `/monitoring` portaient la forme V4 pendant que le serveur en renvoyait une
 * autre, et le test passait — il prouvait seulement que la page savait
 * afficher des champs qui n'existaient plus.
 *
 * Ces cas ancrent les fixtures aux schémas. Une fixture qui dérive fait
 * échouer ce fichier, et non plus la page en production.
 */

const monitoring = {
  breaker: {
    evaluationError: null,
    rates: { checkerDisagreement: 0.12, unusable: null, wrongAtHigh: null },
    reason: null,
    state: 'CLOSED',
    thresholds: { checkerDisagreement: 0.4, unusable: 0.05, wrongAtHigh: 0.1 },
    trippedAt: null,
    window: { observed: 12, size: 50 },
  },
  checker: { disagreed: 2, unavailable: 1 },
  confidence: { high: 4, low: 3, medium: 5, scoreWithheld: 4 },
  corrections: { completed: 8, partial: 3, total: 12, unusable: 1 },
  cost: {
    p50Usd: '0.00300000',
    p90Usd: '0.00900000',
    totalUsd: '0.05200000',
    unknownCostAttempts: 0,
  },
  learner: { helpful: 6, wrong: 2, wrongAtHigh: 1 },
};

describe('credits contracts', () => {
  it('accepte la forme que le serveur renvoie aujourd’hui', () => {
    expect(
      z.safeParse(correctionMonitoringSummarySchema, monitoring).success,
    ).toBe(true);
  });

  it('refuse la forme V4, celle qui avait rendu sept champs vides', () => {
    const legacy = {
      completed: 0,
      hardConstraintLevelMismatchSuspected: 0,
      partial: 0,
      scoreGuardTriggered: 0,
      totalCorrections: 12,
      totalProviderCostUsd: '0.05200000',
      unavailable: 0,
      unknownCostAttempts: 0,
    };
    expect(z.safeParse(correctionMonitoringSummarySchema, legacy).success).toBe(
      false,
    );
  });

  it('refuse un taux à zéro là où le serveur promet null', () => {
    // « Pas assez de données » et « zéro pour cent » sont deux affirmations
    // différentes, et l'écran les rend différemment. Le contrat doit donc
    // distinguer un nombre d'une absence, pas les confondre.
    const withUndefinedRate = {
      ...monitoring,
      breaker: { ...monitoring.breaker, rates: { checkerDisagreement: 0.12 } },
    };
    expect(
      z.safeParse(correctionMonitoringSummarySchema, withUndefinedRate).success,
    ).toBe(false);
  });

  it('refuse un statut de compte inconnu plutôt que de le rendre tel quel', () => {
    // V4.5-166 a ajouté PSEUDONYMISED. Une valeur hors énumération doit
    // arrêter la lecture, pas traverser jusqu'à un libellé manquant.
    const page = {
      items: [
        {
          accountStatus: 'DELETED',
          displayName: 'A',
          email: 'a@b.c',
          projection: {
            free: {
              available: '0',
              consumed: '0',
              expired: '0',
              reserved: '0',
            },
            purchased: {
              available: '0',
              consumed: '0',
              expired: '0',
              reserved: '0',
            },
            totalAvailable: '0',
            totalReserved: '0',
          },
          userId: 'u1',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    };
    expect(z.safeParse(creditMemberPageSchema, page).success).toBe(false);
  });

  it('accepte le préflight tel que l’administration le lit', () => {
    expect(
      z.safeParse(correctionReleasePreflightSchema, {
        apiKeyPresent: true,
        deploymentEnvironment: 'preview',
        identityMatches: true,
        killSwitch: true,
        promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
        state: 'CONFIGURED_CLOSED',
      }).success,
    ).toBe(true);
  });
});
