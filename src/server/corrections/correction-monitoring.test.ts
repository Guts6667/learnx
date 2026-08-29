import type { PrismaClient } from '../../../generated/prisma/client.js';

import { PrismaCorrectionMonitoringService } from './correction-monitoring';

describe('PrismaCorrectionMonitoringService', () => {
  it('agrège coûts, incidents et signaux du pilote sans inventer de valeurs', async () => {
    const prisma = {
      aiCorrection: {
        findMany: vi.fn().mockResolvedValue([
          {
            attempts: [
              {
                costUsd: { toString: () => '0.02000000' },
                status: 'SUCCEEDED',
              },
              { costUsd: null, status: 'FAILED' },
            ],
            structuredResult: {
              correction: {
                monitoringSignals: [
                  'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED',
                  'SCORE_GUARD_TRIGGERED',
                ],
                status: 'COMPLETED_PARTIAL',
              },
            },
          },
          {
            attempts: [
              {
                costUsd: { toString: () => '0.01500000' },
                status: 'SUCCEEDED',
              },
            ],
            structuredResult: {
              correction: { monitoringSignals: [], status: 'COMPLETED' },
            },
          },
        ]),
      },
    } as unknown as PrismaClient;

    await expect(
      new PrismaCorrectionMonitoringService(prisma).summary(),
    ).resolves.toEqual({
      completed: 1,
      hardConstraintLevelMismatchSuspected: 1,
      partial: 1,
      scoreGuardTriggered: 1,
      totalCorrections: 2,
      totalProviderCostUsd: '0.03500000',
      unavailable: 0,
      unknownCostAttempts: 1,
    });
  });
});
