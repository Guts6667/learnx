import type { PrismaClient } from '../../../generated/prisma/client.js';

export type CorrectionMonitoringSignal =
  | 'CHECKER_DISAGREED'
  | 'CHECKER_UNAVAILABLE'
  | 'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED'
  | 'SCORE_GUARD_TRIGGERED';

export interface CorrectionMonitoringSummary {
  /** Corrections where the checker contradicted at least one criterion. */
  checkerDisagreed: number;
  /**
   * Corrections that ran without a usable verdict. A high count with the
   * checker unassigned is a configuration gap; the same count with it assigned
   * is a provider problem. The preflight's `checker` field tells them apart, so
   * a MEDIUM-capped week is never mistaken for a model that went bad.
   */
  checkerUnavailable: number;
  completed: number;
  hardConstraintLevelMismatchSuspected: number;
  partial: number;
  scoreGuardTriggered: number;
  totalCorrections: number;
  totalProviderCostUsd: string;
  unavailable: number;
  unknownCostAttempts: number;
}

interface StoredCorrectionResult {
  correction?: {
    monitoringSignals?: CorrectionMonitoringSignal[];
    status?: 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED';
  };
}

export class PrismaCorrectionMonitoringService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async summary(): Promise<CorrectionMonitoringSummary> {
    const corrections = await this.prisma.aiCorrection.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        attempts: { select: { costUsd: true, status: true } },
        structuredResult: true,
      },
      take: 1_000,
    });
    let checkerDisagreed = 0;
    let checkerUnavailable = 0;
    let completed = 0;
    let hardConstraintLevelMismatchSuspected = 0;
    let partial = 0;
    let scoreGuardTriggered = 0;
    let totalProviderCostUsd = 0;
    let unavailable = 0;
    let unknownCostAttempts = 0;

    for (const correction of corrections) {
      const stored = (correction.structuredResult ??
        {}) as StoredCorrectionResult;
      const result = stored.correction;
      if (result?.status === 'COMPLETED') completed += 1;
      if (result?.status === 'COMPLETED_PARTIAL') partial += 1;
      if (result?.status === 'FAILED') unavailable += 1;
      if (
        result?.monitoringSignals?.includes(
          'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED',
        )
      ) {
        hardConstraintLevelMismatchSuspected += 1;
      }
      if (result?.monitoringSignals?.includes('SCORE_GUARD_TRIGGERED')) {
        scoreGuardTriggered += 1;
      }
      if (result?.monitoringSignals?.includes('CHECKER_DISAGREED')) {
        checkerDisagreed += 1;
      }
      if (result?.monitoringSignals?.includes('CHECKER_UNAVAILABLE')) {
        checkerUnavailable += 1;
      }
      for (const attempt of correction.attempts) {
        if (attempt.costUsd === null) {
          if (attempt.status !== 'PROCESSING') unknownCostAttempts += 1;
          continue;
        }
        totalProviderCostUsd += Number(attempt.costUsd);
      }
    }

    return {
      checkerDisagreed,
      checkerUnavailable,
      completed,
      hardConstraintLevelMismatchSuspected,
      partial,
      scoreGuardTriggered,
      totalCorrections: corrections.length,
      totalProviderCostUsd: totalProviderCostUsd.toFixed(8),
      unavailable,
      unknownCostAttempts,
    };
  }
}
