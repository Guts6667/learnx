import type { PrismaClient } from '../../../generated/prisma/client.js';
import {
  BREAKER_WINDOW_SIZE,
  breakerRates,
} from '../../lib/ai-correction-breaker.js';
import {
  observeCorrections,
  type BreakerStatus,
  type CorrectionBreakerPort,
} from './correction-breaker.js';

export type CorrectionMonitoringSignal =
  | 'CHECKER_DISAGREED'
  | 'CHECKER_UNAVAILABLE'
  | 'HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED'
  | 'SCORE_GUARD_TRIGGERED';

export interface CorrectionMonitoringSummary {
  breaker: BreakerStatus;
  checker: { disagreed: number; unavailable: number };
  /** Counts of corrections by the label shown to the learner. */
  confidence: {
    high: number;
    low: number;
    medium: number;
    scoreWithheld: number;
  };
  corrections: {
    completed: number;
    partial: number;
    total: number;
    /** Delivered nothing; the reservation was released. */
    unusable: number;
  };
  cost: {
    p50Usd: string;
    p90Usd: string;
    totalUsd: string;
    unknownCostAttempts: number;
  };
  /**
   * The only numbers here that do not come from the system's opinion of itself.
   * `wrongAtHigh` is a learner contradicting a criterion we labelled HIGH — a
   * direct falsification of a claim the interface makes on screen.
   */
  learner: { helpful: number; wrong: number; wrongAtHigh: number };
}

interface StoredCorrectionResult {
  correction?: {
    criteria?: { confidence?: unknown; key?: unknown }[];
    indicativeScore?: number | null;
    monitoringSignals?: CorrectionMonitoringSignal[];
    overallConfidence?: 'HIGH' | 'LOW' | 'MEDIUM';
    status?: 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED';
  };
}

/** Nearest-rank, so a reported figure is always one that actually occurred. */
function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0;
}

export class PrismaCorrectionMonitoringService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly breaker: CorrectionBreakerPort,
  ) {}

  public async summary(): Promise<CorrectionMonitoringSummary> {
    const corrections = await this.prisma.aiCorrection.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        attempts: { select: { costUsd: true, status: true } },
        criterionFeedback: { select: { criterionKey: true, verdict: true } },
        structuredResult: true,
      },
      take: 1_000,
    });

    const confidence = { high: 0, low: 0, medium: 0, scoreWithheld: 0 };
    const checker = { disagreed: 0, unavailable: 0 };
    const counts = { completed: 0, partial: 0, unusable: 0 };
    const learner = { helpful: 0, wrong: 0, wrongAtHigh: 0 };
    const costs: number[] = [];
    let totalProviderCostUsd = 0;
    let unknownCostAttempts = 0;

    for (const correction of corrections) {
      const stored = (correction.structuredResult ??
        {}) as StoredCorrectionResult;
      const result = stored.correction;
      if (result?.status === 'COMPLETED') counts.completed += 1;
      if (result?.status === 'COMPLETED_PARTIAL') counts.partial += 1;
      if (result?.status === 'FAILED') counts.unusable += 1;
      if (result?.overallConfidence === 'HIGH') confidence.high += 1;
      if (result?.overallConfidence === 'MEDIUM') confidence.medium += 1;
      if (result?.overallConfidence === 'LOW') confidence.low += 1;
      if (result?.status !== 'FAILED' && result?.indicativeScore == null) {
        confidence.scoreWithheld += 1;
      }
      if (result?.monitoringSignals?.includes('CHECKER_DISAGREED')) {
        checker.disagreed += 1;
      }
      if (result?.monitoringSignals?.includes('CHECKER_UNAVAILABLE')) {
        checker.unavailable += 1;
      }

      const confidenceByKey = new Map<string, unknown>();
      for (const criterion of result?.criteria ?? []) {
        if (typeof criterion.key === 'string') {
          confidenceByKey.set(criterion.key, criterion.confidence);
        }
      }
      for (const vote of correction.criterionFeedback) {
        if (vote.verdict === 'WRONG') learner.wrong += 1;
        else learner.helpful += 1;
        if (
          vote.verdict === 'WRONG' &&
          confidenceByKey.get(vote.criterionKey) === 'HIGH'
        ) {
          learner.wrongAtHigh += 1;
        }
      }

      for (const attempt of correction.attempts) {
        if (attempt.costUsd === null) {
          if (attempt.status !== 'PROCESSING') unknownCostAttempts += 1;
          continue;
        }
        const cost = Number(attempt.costUsd);
        totalProviderCostUsd += cost;
        costs.push(cost);
      }
    }

    costs.sort((a, b) => a - b);
    // Reading, never measuring: a GET that could trip a guardrail would make
    // opening the admin page an action. The breaker is evaluated on the path it
    // protects, at quote time.
    const state = await this.breaker.status();
    const window = corrections.slice(0, BREAKER_WINDOW_SIZE);
    const rates =
      state.state === 'OPEN'
        ? state.rates
        : breakerRates(observeCorrections(window));

    return {
      breaker: {
        ...state,
        rates,
        window: { observed: window.length, size: BREAKER_WINDOW_SIZE },
      },
      checker,
      confidence,
      corrections: { ...counts, total: corrections.length },
      cost: {
        p50Usd: percentile(costs, 0.5).toFixed(8),
        p90Usd: percentile(costs, 0.9).toFixed(8),
        totalUsd: totalProviderCostUsd.toFixed(8),
        unknownCostAttempts,
      },
      learner,
    };
  }
}
