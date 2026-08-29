import { correctionContractSchema } from '../../lib/ai-correction-contracts.js';
import { getCorrectionProviderAdapter } from '../../lib/ai-correction-provider-adapters.js';
import { CorrectionExecutionService } from './correction-execution-service.js';
import {
  CorrectionOrchestrationError,
  type AcceptedQuotePort,
  type AcceptedQuoteSnapshot,
  type CorrectionPersistencePort,
  type CorrectionTransportPort,
  type CreditSettlementPort,
  type OrchestratedCorrectionResult,
} from './correction-orchestration-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';

export * from './correction-orchestration-contracts.js';

type ParsedContract = ReturnType<typeof correctionContractSchema.parse>;

function assertCompatibleQuote(
  quote: AcceptedQuoteSnapshot,
  contract: ParsedContract,
): void {
  const inScope =
    PROMOTED_CORRECTION_IDENTITY.activityTypeScope.some(
      (activityType) => activityType === contract.target.activityType,
    ) &&
    PROMOTED_CORRECTION_IDENTITY.targetKindScope.some(
      (kind) => kind === contract.target.kind,
    ) &&
    PROMOTED_CORRECTION_IDENTITY.languageScope.some(
      (language) => language === quote.language,
    );
  const exactIdentity =
    quote.contractKey === contract.contractKey &&
    quote.contractVersion === contract.version &&
    quote.modelId === PROMOTED_CORRECTION_IDENTITY.modelId &&
    quote.provider === PROMOTED_CORRECTION_IDENTITY.provider &&
    quote.promptVersion === PROMOTED_CORRECTION_IDENTITY.promptVersion;
  const validAction =
    ((quote.action ?? 'STANDARD') === 'RECONSIDERATION') ===
    Boolean(quote.reconsideration);
  if (
    !inScope ||
    !exactIdentity ||
    !quote.includesAutomaticSecondPass ||
    !validAction
  ) {
    throw new CorrectionOrchestrationError('QUOTE_INCOMPATIBLE');
  }
}

export class CorrectionOrchestrationService {
  private readonly execution: CorrectionExecutionService;

  public constructor(
    private readonly quotes: AcceptedQuotePort,
    private readonly credits: CreditSettlementPort,
    private readonly corrections: CorrectionPersistencePort,
    transport: CorrectionTransportPort,
    private readonly options: { apiKey: string; now?: () => Date },
  ) {
    this.execution = new CorrectionExecutionService(
      corrections,
      transport,
      options.apiKey,
    );
  }

  public async runAcceptedQuote(input: {
    quoteId: string;
    userId: string;
  }): Promise<OrchestratedCorrectionResult> {
    const { now, quote } = await this.loadQuote(input);
    const contract = correctionContractSchema.parse(quote.contract);
    assertCompatibleQuote(quote, contract);
    const replay = await this.replayIfAvailable(quote, input.userId);
    if (replay) return replay;
    const reservationId = await this.reserveQuote(quote, input.userId, now);
    const correctionId = await this.beginCorrection(
      quote,
      reservationId,
      input.userId,
    );
    const correction = await this.executeAndPersist({
      contract,
      correctionId,
      quote,
      reservationId,
      userId: input.userId,
    });
    const charged = await this.closeReservation(
      correction,
      quote,
      reservationId,
      input.userId,
    );
    await this.quotes.markConsumed({ quoteId: quote.quoteId });
    return this.result(correction, quote, false, charged);
  }

  private async loadQuote(input: { quoteId: string; userId: string }) {
    const now = this.options.now?.() ?? new Date();
    const quote = await this.quotes.loadAcceptedQuote({ ...input, now });
    if (!quote) throw new CorrectionOrchestrationError('QUOTE_NOT_FOUND');
    if (quote.expiresAt.getTime() <= now.getTime()) {
      throw new CorrectionOrchestrationError('QUOTE_EXPIRED');
    }
    return { now, quote };
  }

  private async replayIfAvailable(
    quote: AcceptedQuoteSnapshot,
    userId: string,
  ): Promise<OrchestratedCorrectionResult | null> {
    const replay = await this.corrections.findByQuote({
      requestFingerprint: quote.requestFingerprint,
      userId,
    });
    if (!replay) return null;
    if (replay.state === 'READY') return replay.result;
    if (replay.state === 'READY_TO_SETTLE') {
      const charged = await this.closeReservation(
        replay.result.correction,
        quote,
        replay.reservationId,
        userId,
      );
      await this.quotes.markConsumed({ quoteId: quote.quoteId });
      return {
        ...this.result(replay.result.correction, quote, true, charged),
      };
    }
    throw new CorrectionOrchestrationError(
      replay.state === 'IN_PROGRESS'
        ? 'QUOTE_ALREADY_CONSUMED'
        : 'FINANCIAL_RECONCILIATION_REQUIRED',
    );
  }

  private async reserveQuote(
    quote: AcceptedQuoteSnapshot,
    userId: string,
    now: Date,
  ): Promise<string> {
    try {
      const reservation = await this.credits.reserve({
        amount: quote.maximumReservedCredits,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        idempotencyKey: `ai-correction:${quote.quoteId}`,
        reference: { id: quote.quoteId, type: 'AI_PRICING_QUOTE' },
        userId,
      });
      return reservation.reservationId;
    } catch {
      throw new CorrectionOrchestrationError('INSUFFICIENT_CREDITS');
    }
  }

  private async beginCorrection(
    quote: AcceptedQuoteSnapshot,
    reservationId: string,
    userId: string,
  ): Promise<string> {
    try {
      const started = await this.corrections.begin({
        quote,
        reservationId,
        userId,
      });
      if (!started.created) {
        throw new CorrectionOrchestrationError('QUOTE_ALREADY_CONSUMED');
      }
      return started.correctionId;
    } catch (error) {
      if (error instanceof CorrectionOrchestrationError) throw error;
      await this.releaseAfterStartFailure(error, reservationId, userId);
      throw error;
    }
  }

  private async releaseAfterStartFailure(
    error: unknown,
    reservationId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.credits.release({ reservationId, userId });
    } catch (releaseError) {
      throw new AggregateError(
        [error, releaseError],
        'AI_CORRECTION_START_FAILED_AND_RESERVATION_RELEASE_FAILED',
        { cause: releaseError },
      );
    }
  }

  private async executeAndPersist(input: {
    contract: ParsedContract;
    correctionId: string;
    quote: AcceptedQuoteSnapshot;
    reservationId: string;
    userId: string;
  }): Promise<OrchestratedCorrectionResult['correction']> {
    try {
      const execution = await this.execution.execute(input);
      await this.corrections.finalize({
        correctionId: input.correctionId,
        quote: input.quote,
        result: execution.correction,
      });
      return { ...execution.correction, id: input.correctionId };
    } catch (error) {
      await this.reconcileExecutionFailure(error, input);
      throw error;
    }
  }

  private async reconcileExecutionFailure(
    error: unknown,
    input: { correctionId: string; reservationId: string; userId: string },
  ): Promise<void> {
    let reconciliationError: unknown;
    try {
      await this.corrections.markReconciliationRequired({
        correctionId: input.correctionId,
      });
    } catch (markError) {
      reconciliationError = markError;
    }
    try {
      await this.credits.release(input);
    } catch (releaseError) {
      throw new AggregateError(
        [error, reconciliationError, releaseError].filter(
          (candidate) => candidate !== undefined,
        ),
        'AI_CORRECTION_FAILED_AND_RESERVATION_RELEASE_FAILED',
        { cause: releaseError },
      );
    }
    if (reconciliationError !== undefined) {
      throw new AggregateError(
        [error, reconciliationError],
        'AI_CORRECTION_FAILED_AND_RECONCILIATION_MARK_FAILED',
        { cause: error },
      );
    }
  }

  /**
   * A correction that delivered nothing releases its reservation instead of
   * settling it. Charging the accepted price for a partial delivery is a
   * deliberate economic decision — the learner consented to it — but charging
   * for an empty result is not a decision, it is a defect the learner pays for.
   *
   * Returns whether the reservation was charged, so the settlement figures the
   * caller reports describe what actually happened.
   */
  private async closeReservation(
    correction: OrchestratedCorrectionResult['correction'],
    quote: AcceptedQuoteSnapshot,
    reservationId: string,
    userId: string,
  ): Promise<boolean> {
    if (correction.status === 'FAILED') {
      await this.credits.release({ reservationId, userId });
      return false;
    }
    await this.settleQuote(quote, reservationId, userId);
    return true;
  }

  private async settleQuote(
    quote: AcceptedQuoteSnapshot,
    reservationId: string,
    userId: string,
  ): Promise<void> {
    await this.credits.settle({
      amount: quote.estimatedCredits,
      reservationId,
      userId,
    });
  }

  private result(
    correction: OrchestratedCorrectionResult['correction'],
    quote: AcceptedQuoteSnapshot,
    replay: boolean,
    charged = true,
  ): OrchestratedCorrectionResult {
    const settled = charged ? quote.estimatedCredits : 0n;
    return {
      correction,
      replay,
      settlement: {
        reservedCredits: quote.maximumReservedCredits.toString(),
        releasedCredits: (quote.maximumReservedCredits - settled).toString(),
        settledCredits: settled.toString(),
      },
    };
  }
}

export function createRuntimeCorrectionTransport(): CorrectionTransportPort {
  const adapter = getCorrectionProviderAdapter('OPENROUTER_CHAT');
  const profile = {
    ...PROMOTED_CORRECTION_IDENTITY.requestProfile,
    routeProviders: [
      ...PROMOTED_CORRECTION_IDENTITY.requestProfile.routeProviders,
    ],
  };
  return {
    async execute(input) {
      const result = await adapter.execute({ ...input, profile });
      return {
        latencyMs: result.latencyMs,
        modelSnapshot: result.modelSnapshot,
        output: result.output,
        providerRequestId: result.providerRequestId,
        providerRoute: result.providerRoute,
        usage: result.usage,
      };
    },
  };
}
