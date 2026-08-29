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
  /**
   * The rates recorded on the trip, for the reason that tripped it. Never
   * re-measured: the window has moved since, so a fresh measurement would
   * answer "what is it now" where the admin is asking "what tripped this".
   * Other reasons stay null rather than being filled from a current reading.
   */
  trippedRates: BreakerRates;
  window: { observed: number; size: number };
}

export interface BreakerJournalEvent {
  actorId: string | null;
  actorName: string | null;
  alertError: string | null;
  alertedAt: string | null;
  at: string;
  id: string;
  kind: 'REOPENED' | 'TRIPPED';
  note: string | null;
  rate: number | null;
  reason: BreakerReason | null;
  threshold: number | null;
  windowSize: number | null;
}

/**
 * The owner alert channel. Optional: an environment without e-mail configured
 * still trips, latches and refuses — it simply cannot tell anyone, and says so
 * in the journal rather than pretending it did.
 */
export interface BreakerAlertPort {
  send(input: {
    facts: string[];
    headline: string;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface CorrectionBreakerPort {
  /** Reads the latched state without measuring or writing. */
  status(): Promise<BreakerStatus>;
  /** Measures, trips and latches if a rule is crossed, then returns the state. */
  evaluate(): Promise<BreakerStatus>;
  reopen(input: { actorId: string; note?: string }): Promise<void>;
  /** Newest first. The journal is what makes a reopen auditable. */
  events(input?: { limit?: number }): Promise<BreakerJournalEvent[]>;
}

const NO_RATES: BreakerRates = {
  checkerDisagreement: null,
  unusable: null,
  wrongAtHigh: null,
};

const CLOSED: Omit<BreakerStatus, 'rates' | 'window'> = {
  evaluationError: null,
  reason: null,
  state: 'CLOSED',
  thresholds: BREAKER_THRESHOLDS,
  trippedAt: null,
  trippedRates: NO_RATES,
};

export class PrismaCorrectionBreaker implements CorrectionBreakerPort {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly alert?: BreakerAlertPort,
  ) {}

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
      select: { createdAt: true, id: true },
    });
    // The trip is durable before anyone is told, so a provider outage can never
    // stop the breaker latching. The learner is refused because corrections are
    // suspended, never because an e-mail failed.
    await this.notify(event.id, reason, rate);
    return {
      evaluationError: null,
      rates,
      reason,
      state: 'OPEN',
      thresholds: BREAKER_THRESHOLDS,
      trippedAt: event.createdAt.toISOString(),
      trippedRates: ratesAt(reason, rate),
      window,
    };
  }

  public async events(
    input: { limit?: number } = {},
  ): Promise<BreakerJournalEvent[]> {
    const rows = await this.prisma.aiCorrectionBreakerEvent.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        actor: { select: { displayName: true } },
        actorId: true,
        alertError: true,
        alertedAt: true,
        createdAt: true,
        id: true,
        note: true,
        rate: true,
        reason: true,
        threshold: true,
        windowSize: true,
      },
      take: Math.min(Math.max(input.limit ?? 100, 1), 100),
    });
    return rows.map((row) => ({
      actorId: row.actorId,
      actorName: row.actor?.displayName ?? null,
      alertError: row.alertError,
      alertedAt: row.alertedAt?.toISOString() ?? null,
      at: row.createdAt.toISOString(),
      id: row.id,
      kind: row.action,
      note: row.note,
      rate: row.rate,
      reason: row.reason,
      threshold: row.threshold,
      windowSize: row.windowSize,
    }));
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

  /**
   * Best effort, and recorded either way. An owner who was never told must at
   * least be discoverable: an alert lost in silence brings back the failure
   * this alerting exists to remove.
   *
   * The message carries the reason, the rates and the window — never a
   * learner's production, feedback or quotes. A guardrail that trips because
   * corrections are going wrong must not put those corrections in an e-mail.
   */
  private async notify(
    eventId: string,
    reason: BreakerReason,
    rate: number | null,
  ): Promise<void> {
    if (!this.alert) {
      await this.stampAlert(eventId, 'ALERT_CHANNEL_NOT_CONFIGURED');
      return;
    }
    try {
      await this.alert.send({
        facts: [
          `Cause : ${reason}`,
          `Taux mesuré : ${rate === null ? 'indisponible' : rate.toFixed(4)}`,
          `Seuil : ${thresholdFor(reason)}`,
          `Fenêtre : ${BREAKER_WINDOW_SIZE} corrections`,
          'La correction IA est suspendue jusqu’à réouverture manuelle.',
        ],
        headline: 'coupe-circuit de correction déclenché',
        idempotencyKey: eventId,
      });
      await this.prisma.aiCorrectionBreakerEvent.update({
        data: { alertedAt: new Date() },
        where: { id: eventId },
      });
    } catch (error) {
      await this.stampAlert(
        eventId,
        error instanceof Error ? error.message : 'ALERT_FAILED',
      );
    }
  }

  private async stampAlert(eventId: string, reason: string): Promise<void> {
    try {
      await this.prisma.aiCorrectionBreakerEvent.update({
        data: { alertError: reason.slice(0, 500) },
        where: { id: eventId },
      });
    } catch {
      // Recording the failure has itself failed. Nothing further is available
      // here, and the trip stands regardless — which is the property that
      // matters.
    }
  }

  /** The open state, or null when the latest event is a reopen or none exists. */
  private async latched(): Promise<Omit<
    BreakerStatus,
    'rates' | 'window'
  > | null> {
    const latest = await this.prisma.aiCorrectionBreakerEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        createdAt: true,
        rate: true,
        reason: true,
      },
    });
    if (!latest || latest.action !== 'TRIPPED') return null;
    return {
      evaluationError: null,
      reason: latest.reason,
      state: 'OPEN',
      thresholds: BREAKER_THRESHOLDS,
      trippedAt: latest.createdAt.toISOString(),
      // Read back from the trip, not measured again.
      trippedRates: ratesAt(latest.reason, latest.rate),
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

/**
 * The recorded rate placed under the reason it belongs to, leaving the others
 * null. Filling them from a current reading would put two different questions
 * — "what tripped this" and "what is it now" — side by side under one label.
 */
function ratesAt(
  reason: BreakerReason | null,
  rate: number | null,
): BreakerRates {
  if (reason === null) return NO_RATES;
  if (reason === 'CHECKER_DISAGREEMENT') {
    return { ...NO_RATES, checkerDisagreement: rate };
  }
  if (reason === 'UNUSABLE_RATE') return { ...NO_RATES, unusable: rate };
  return { ...NO_RATES, wrongAtHigh: rate };
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
