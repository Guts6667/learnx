import type { PrismaClient } from '../../../generated/prisma/client.js';
import {
  BREAKER_THRESHOLDS,
  BREAKER_WINDOW_SIZE,
  breakerRates,
  breakerTripReason,
  type BreakerObservations,
  type BreakerRates,
  type BreakerReason,
} from '../../lib/ai-correction-breaker.js';

export interface BreakerStatus {
  /**
   * Non-null when the rule could not be measured. The breaker stays CLOSED in
   * that case, deliberately, and this is what lets the admin page say
   * "guardrail blind since <when>" instead of showing a healthy zero.
   */
  evaluationError: string | null;
  rates: BreakerRates;
  reason: BreakerReason | null;
  state: 'CLOSED' | 'OPEN';
  thresholds: typeof BREAKER_THRESHOLDS;
  trippedAt: string | null;
  window: { observed: number; size: number };
}

export interface CorrectionBreakerPort {
  /** Reads the latched state without measuring or writing. */
  status(): Promise<BreakerStatus>;
  /** Measures, trips and latches if a rule is crossed, then returns the state. */
  evaluate(): Promise<BreakerStatus>;
  reopen(input: { actorId: string; note?: string }): Promise<void>;
}

const CLOSED: Omit<BreakerStatus, 'rates' | 'window'> = {
  evaluationError: null,
  reason: null,
  state: 'CLOSED',
  thresholds: BREAKER_THRESHOLDS,
  trippedAt: null,
};

const NO_RATES: BreakerRates = {
  checkerDisagreement: null,
  unusable: null,
  wrongAtHigh: null,
};

export class PrismaCorrectionBreaker implements CorrectionBreakerPort {
  public constructor(private readonly prisma: PrismaClient) {}

  public async status(): Promise<BreakerStatus> {
    const latched = await this.latched();
    if (latched)
      return {
        ...latched,
        rates: NO_RATES,
        window: { observed: 0, size: BREAKER_WINDOW_SIZE },
      };
    return {
      ...CLOSED,
      rates: NO_RATES,
      window: { observed: 0, size: BREAKER_WINDOW_SIZE },
    };
  }

  public async evaluate(): Promise<BreakerStatus> {
    const latched = await this.latched();
    if (latched) {
      // Already open. It stays open until a human writes a reopen event, so
      // there is nothing to measure and nothing that could close it here.
      return {
        ...latched,
        rates: NO_RATES,
        window: { observed: 0, size: BREAKER_WINDOW_SIZE },
      };
    }

    let observations: BreakerObservations;
    try {
      observations = await this.observe();
    } catch (error) {
      // The checker fails closed because its failure costs a confidence
      // ceiling; the breaker failing open would cost the product against a
      // rate that moves over hours. So an unmeasurable breaker keeps serving
      // and says so, loudly, rather than tripping on infrastructure noise.
      return {
        ...CLOSED,
        evaluationError:
          error instanceof Error ? error.message : 'BREAKER_EVALUATION_FAILED',
        rates: NO_RATES,
        window: { observed: 0, size: BREAKER_WINDOW_SIZE },
      };
    }

    const rates = breakerRates(observations);
    const reason = breakerTripReason(rates);
    const window = {
      observed: observations.windowObserved,
      size: BREAKER_WINDOW_SIZE,
    };
    if (!reason) return { ...CLOSED, rates, window };

    const rate = rateFor(reason, rates);
    const event = await this.prisma.aiCorrectionBreakerEvent.create({
      data: {
        action: 'TRIPPED',
        rate,
        reason,
        threshold: thresholdFor(reason),
        windowSize: BREAKER_WINDOW_SIZE,
      },
      select: { createdAt: true },
    });
    return {
      evaluationError: null,
      rates,
      reason,
      state: 'OPEN',
      thresholds: BREAKER_THRESHOLDS,
      trippedAt: event.createdAt.toISOString(),
      window,
    };
  }

  public async reopen(input: {
    actorId: string;
    note?: string;
  }): Promise<void> {
    await this.prisma.aiCorrectionBreakerEvent.create({
      data: {
        action: 'REOPENED',
        actorId: input.actorId,
        ...(input.note === undefined ? {} : { note: input.note }),
      },
    });
  }

  /** The open state, or null when the latest event is a reopen or none exists. */
  private async latched(): Promise<Omit<
    BreakerStatus,
    'rates' | 'window'
  > | null> {
    const latest = await this.prisma.aiCorrectionBreakerEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { action: true, createdAt: true, reason: true },
    });
    if (!latest || latest.action !== 'TRIPPED') return null;
    return {
      evaluationError: null,
      reason: latest.reason,
      state: 'OPEN',
      thresholds: BREAKER_THRESHOLDS,
      trippedAt: latest.createdAt.toISOString(),
    };
  }

  private async observe(): Promise<BreakerObservations> {
    const corrections = await this.prisma.aiCorrection.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        criterionFeedback: { select: { criterionKey: true, verdict: true } },
        structuredResult: true,
      },
      take: BREAKER_WINDOW_SIZE,
    });
    return observeCorrections(corrections);
  }
}

interface ObservedCorrection {
  criterionFeedback: { criterionKey: string; verdict: 'HELPFUL' | 'WRONG' }[];
  structuredResult: unknown;
}

/**
 * Exported for the monitoring service, which needs the same counts without
 * repeating the interpretation of a stored correction.
 */
export function observeCorrections(
  corrections: ObservedCorrection[],
): BreakerObservations {
  let checkerDisagreed = 0;
  let unusable = 0;
  let highCriteriaVoted = 0;
  let highCriteriaVotedWrong = 0;

  for (const correction of corrections) {
    const stored = (correction.structuredResult ?? {}) as {
      correction?: {
        criteria?: { confidence?: unknown; key?: unknown }[];
        monitoringSignals?: string[];
        status?: string;
      };
    };
    const result = stored.correction;
    if (result?.monitoringSignals?.includes('CHECKER_DISAGREED')) {
      checkerDisagreed += 1;
    }
    if (result?.status === 'FAILED') unusable += 1;

    const confidenceByKey = new Map<string, unknown>();
    for (const criterion of result?.criteria ?? []) {
      if (typeof criterion.key === 'string') {
        confidenceByKey.set(criterion.key, criterion.confidence);
      }
    }
    for (const vote of correction.criterionFeedback) {
      // Only HIGH-labelled criteria count towards the learner rule: the claim
      // being tested is the one the interface makes most strongly.
      if (confidenceByKey.get(vote.criterionKey) !== 'HIGH') continue;
      highCriteriaVoted += 1;
      if (vote.verdict === 'WRONG') highCriteriaVotedWrong += 1;
    }
  }

  return {
    checkerDisagreed,
    highCriteriaVoted,
    highCriteriaVotedWrong,
    unusable,
    windowObserved: corrections.length,
  };
}

function rateFor(reason: BreakerReason, rates: BreakerRates): number | null {
  if (reason === 'CHECKER_DISAGREEMENT') return rates.checkerDisagreement;
  if (reason === 'UNUSABLE_RATE') return rates.unusable;
  return rates.wrongAtHigh;
}

function thresholdFor(reason: BreakerReason): number {
  if (reason === 'CHECKER_DISAGREEMENT') {
    return BREAKER_THRESHOLDS.checkerDisagreement;
  }
  if (reason === 'UNUSABLE_RATE') return BREAKER_THRESHOLDS.unusable;
  return BREAKER_THRESHOLDS.wrongAtHigh;
}
