import {
  buildProtocol3TransportJsonSchema,
  correctionContractSchema,
  deriveCorrectionSecondPassDecision,
  type CorrectionContract,
  type CorrectionOutput,
  type Protocol3CorrectionArtifactOutput,
} from '@/lib/ai-correction-contracts';
import {
  getCorrectionProviderAdapter,
} from '@/lib/ai-correction-provider-adapters';
import {
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '@/lib/ai-correction-benchmark';
import { sanitizeStructuredOutputJsonSchema } from '@/lib/ai-json-schema.ts';

import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';
import { buildRuntimeCorrectionMessages } from './runtime-correction-prompt';

/**
 * V4-009 — Orchestration devis accepté → réservation → correction → règlement.
 *
 * Doctrine économique (règle 10 de BACKLOG_V4.md, décision du Propriétaire) :
 * le devis accepté est débité en intégralité (estimatedCredits) quel que soit
 * le nombre de critères livrés ; la réservation couvre le plafond
 * (maximumReservedCredits) et la différence est libérée immédiatement. Aucun
 * remboursement, compensation ou relance gratuite n'existe ; le consentement
 * préalable énonce explicitement qu'un critère peut revenir « à retravailler ».
 *
 * Livraison PARTIAL_CRITERION (identité promue v3-1) : chaque critère est
 * validé indépendamment ; un critère invérifiable est livré en état
 * « à retravailler » sans invalider la correction ni le règlement. Une
 * correction dont aucun critère n'est livrable reste un échec technique —
 * débité au prix du devis conformément à la doctrine — avec un état
 * « indisponible » honnête et une invitation à resoumettre.
 */
export type CorrectionOrchestrationErrorCode =
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_NOT_ACTIVE'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_ALREADY_CONSUMED'
  | 'QUOTE_INCOMPATIBLE'
  | 'INSUFFICIENT_CREDITS';

export class CorrectionOrchestrationError extends Error {
  public constructor(
    public readonly code: CorrectionOrchestrationErrorCode,
  ) {
    super(code);
    this.name = 'CorrectionOrchestrationError';
  }
}

export interface AcceptedQuoteSnapshot {
  quoteId: string;
  userId: string;
  target: { id: string; kind: 'EXERCISE_SUBMISSION' | 'STAGE_ASSESSMENT_SUBMISSION' };
  estimatedCredits: bigint;
  maximumReservedCredits: bigint;
  expiresAt: Date;
  promptVersion: string;
  contractKey: string;
  contractVersion: string;
  requestFingerprint: string;
  submissionText: string;
  exerciseInstructions: string;
  taskContext: string | null;
  contract: unknown;
}

export interface CreditSettlementPort {
  reserve(input: {
    amount: bigint;
    expiresAt: Date;
    idempotencyKey: string;
    reference: { id: string; type: string };
    userId: string;
  }): Promise<{ reservationId: string }>;
  settle(input: {
    amount: bigint;
    reservationId: string;
    userId: string;
  }): Promise<void>;
  release(input: { reservationId: string; userId: string }): Promise<void>;
}

export interface CorrectionTransportPort {
  execute(input: {
    apiKey: string;
    jsonSchema: Record<string, unknown>;
    messages: Array<{ content: string; role: 'system' | 'user' }>;
    modelId: string;
  }): Promise<{
    latencyMs: number;
    output: unknown;
    providerRequestId?: string;
    usage: {
      actualCostUsd?: number;
      inputTokens: number;
      reasoningTokens: number;
      visibleOutputTokens: number;
    };
  }>;
}

export interface OrchestratedCorrectionResult {
  correction: {
    id: string;
    status: 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED';
    criteria: Array<{
      key: string;
      label: string;
      weight: number;
      levelKey: string;
      levelLabel: string;
      evidenceStatus: 'FOUND' | 'NO_RELEVANT_EVIDENCE';
      evidenceQuotes: string[];
      feedback: string;
    }>;
    unsureCriteria: string[];
    overallFeedback: string | null;
    indicativeScore: number | null;
    secondPassRequired: boolean;
    modelUsageCostUsd: number;
  };
  settlement: {
    reservedCredits: string;
    settledCredits: string;
    releasedCredits: string;
  };
  replay: boolean;
}

// Identité promue v3-1 : deux retries bornés + la tentative initiale.
const MAX_RUNTIME_ATTEMPTS = 3;

function levelLabel(
  contract: CorrectionContract,
  criterionKey: string,
  levelKey: string,
): string {
  const criterion = contract.criteria.find((item) => item.key === criterionKey);
  return (
    criterion?.performanceLevels.find((level) => level.key === levelKey)
      ?.label ?? levelKey
  );
}

function weightedIndicativeScore(
  contract: CorrectionContract,
  output: Protocol3CorrectionArtifactOutput,
): number {
  const deliveredWeight = output.criteria.reduce((total, criterion) => {
    const weight =
      contract.criteria.find((item) => item.key === criterion.criterionKey)
        ?.weight ?? 0;
    return total + weight;
  }, 0);
  if (deliveredWeight <= 0) {
    return 0;
  }
  const total = output.criteria.reduce((accumulated, criterion) => {
    const contractCriterion = contract.criteria.find(
      (item) => item.key === criterion.criterionKey,
    );
    if (!contractCriterion) {
      return accumulated;
    }
    const score =
      contractCriterion.performanceLevels.find(
        (level) => level.key === criterion.levelKey,
      )?.score ?? 0;
    return accumulated + contractCriterion.weight * score;
  }, 0);
  return Math.round((total / deliveredWeight) * 100) / 100;
}

export class CorrectionOrchestrationService {
  public constructor(
    private readonly quotes: {
      loadAcceptedQuote(input: {
        quoteId: string;
        userId: string;
        now: Date;
      }): Promise<AcceptedQuoteSnapshot | null>;
      markConsumed(input: { quoteId: string }): Promise<void>;
    },
    private readonly credits: CreditSettlementPort,
    private readonly corrections: {
      findByQuote(input: {
        userId: string;
        requestFingerprint: string;
      }): Promise<OrchestratedCorrectionResult | null>;
      persist(input: {
        userId: string;
        quote: AcceptedQuoteSnapshot;
        result: OrchestratedCorrectionResult['correction'];
      }): Promise<{ id: string }>;
    },
    private readonly transport: CorrectionTransportPort,
    private readonly options: {
      apiKey: string;
      now?: () => Date;
    },
  ) {}

  public async runAcceptedQuote(input: {
    quoteId: string;
    userId: string;
  }): Promise<OrchestratedCorrectionResult> {
    const now = this.options.now?.() ?? new Date();
    const quote = await this.quotes.loadAcceptedQuote({
      quoteId: input.quoteId,
      userId: input.userId,
      now,
    });
    if (!quote) {
      throw new CorrectionOrchestrationError('QUOTE_NOT_FOUND');
    }
    if (quote.expiresAt.getTime() <= now.getTime()) {
      throw new CorrectionOrchestrationError('QUOTE_EXPIRED');
    }

    const replayed = await this.corrections.findByQuote({
      requestFingerprint: quote.requestFingerprint,
      userId: input.userId,
    });
    if (replayed) {
      return replayed;
    }

    const contract = correctionContractSchema.parse(quote.contract);

    let reservationId: string;
    try {
      const reservation = await this.credits.reserve({
        amount: quote.maximumReservedCredits,
        expiresAt: new Date(
          now.getTime() + 15 * 60 * 1000,
        ),
        idempotencyKey: `ai-correction:${quote.quoteId}`,
        reference: { id: quote.quoteId, type: 'AI_PRICING_QUOTE' },
        userId: input.userId,
      });
      reservationId = reservation.reservationId;
    } catch {
      throw new CorrectionOrchestrationError('INSUFFICIENT_CREDITS');
    }

    // Un échec total (aucun critère livrable après retries bornés) reste un
    // résultat : la doctrine débite le devis en intégralité et l'état livré
    // est « indisponible — resoumettre ». Une erreur d'infrastructure
    // inattendue remonte sans règlement : la réservation idempotente expire
    // d'elle-même et un rejeu reprend la même réservation.
    const outcome = await this.executeCorrection({ contract, quote });

    const persisted = await this.corrections.persist({
      quote,
      result: outcome,
      userId: input.userId,
    });
    const correction = { ...outcome, id: persisted.id };
    await this.settleFullQuote({ quote, reservationId, userId: input.userId });
    await this.quotes.markConsumed({ quoteId: quote.quoteId });
    return this.asResult({ correction, quote, replay: false });
  }

  private async settleFullQuote(input: {
    quote: AcceptedQuoteSnapshot;
    reservationId: string;
    userId: string;
  }): Promise<void> {
    await this.credits.settle({
      amount: input.quote.estimatedCredits,
      reservationId: input.reservationId,
      userId: input.userId,
    });
    const difference =
      input.quote.maximumReservedCredits - input.quote.estimatedCredits;
    if (difference > 0n) {
      await this.credits.release({
        reservationId: input.reservationId,
        userId: input.userId,
      });
    }
  }

  private asResult(input: {
    correction: OrchestratedCorrectionResult['correction'];
    quote: AcceptedQuoteSnapshot;
    replay: boolean;
  }): OrchestratedCorrectionResult {
    return {
      correction: input.correction,
      replay: input.replay,
      settlement: {
        reservedCredits: input.quote.maximumReservedCredits.toString(),
        releasedCredits: (
          input.quote.maximumReservedCredits - input.quote.estimatedCredits
        ).toString(),
        settledCredits: input.quote.estimatedCredits.toString(),
      },
    };
  }

  private async executeCorrection(input: {
    contract: CorrectionContract;
    quote: AcceptedQuoteSnapshot;
  }): Promise<OrchestratedCorrectionResult['correction']> {
    const messages = buildRuntimeCorrectionMessages({
      contract: input.contract,
      exerciseInstructions: input.quote.exerciseInstructions,
      submissionText: input.quote.submissionText,
      taskContext: input.quote.taskContext ?? undefined,
    });
    const jsonSchema = sanitizeStructuredOutputJsonSchema(
      buildProtocol3TransportJsonSchema(input.contract),
    ) as Record<string, unknown>;

    let usageCost = 0;
    for (let attempt = 1; attempt <= MAX_RUNTIME_ATTEMPTS; attempt += 1) {
      let generation;
      try {
        generation = await this.transport.execute({
          apiKey: this.options.apiKey,
          jsonSchema,
          messages,
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
        });
      } catch {
        continue;
      }
      usageCost += generation.usage.actualCostUsd ?? 0;
      try {
        const strict = validateBenchmarkProtocol3ModelOutputWithEvidence({
          benchmarkCase: { responseText: input.quote.submissionText },
          contract: input.contract,
          output: generation.output,
        });
        return this.toOutcome({
          contract: input.contract,
          output: strict.output,
          unsureCriteria: [],
          usageCost,
        });
      } catch {
        // pas de validateur d'injection runtime : le prompt et la discipline
        // de preuve tiennent ce rôle ; tenter la récupération partielle.
      }
      try {
        const salvaged = salvageProtocol3PartialCorrection({
          benchmarkCase: { responseText: input.quote.submissionText },
          contract: input.contract,
          output: generation.output,
        });
        return this.toOutcome({
          contract: input.contract,
          output: salvaged.output,
          unsureCriteria: salvaged.unsureCriteria,
          usageCost,
        });
      } catch {
        continue;
      }
    }
    return {
      id: '',
      status: 'FAILED',
      criteria: [],
      unsureCriteria: [],
      overallFeedback: null,
      indicativeScore: null,
      secondPassRequired: false,
      modelUsageCostUsd: usageCost,
    };
  }

  private toOutcome(input: {
    contract: CorrectionContract;
    output: Protocol3CorrectionArtifactOutput;
    unsureCriteria: string[];
    usageCost: number;
  }): OrchestratedCorrectionResult['correction'] {
    const deliveredAll = input.unsureCriteria.length === 0;
    const score = deliveredAll
      ? weightedIndicativeScore(input.contract, input.output)
      : null;
    return {
      id: '',
      status: deliveredAll ? 'COMPLETED' : 'COMPLETED_PARTIAL',
      criteria: input.output.criteria.map((criterion) => ({
        key: criterion.criterionKey,
        label:
          input.contract.criteria.find(
            (item) => item.key === criterion.criterionKey,
          )?.label ?? criterion.criterionKey,
        weight:
          input.contract.criteria.find(
            (item) => item.key === criterion.criterionKey,
          )?.weight ?? 0,
        levelKey: criterion.levelKey,
        levelLabel: levelLabel(
          input.contract,
          criterion.criterionKey,
          criterion.levelKey,
        ),
        evidenceStatus: criterion.evidenceStatus,
        evidenceQuotes: criterion.evidenceQuotes,
        feedback: criterion.feedback,
      })),
      unsureCriteria: input.unsureCriteria,
      overallFeedback: input.output.overallFeedback,
      indicativeScore: score,
      secondPassRequired: deriveCorrectionSecondPassDecision({
        contract: input.contract,
        evaluations: [
          input.output as unknown as CorrectionOutput,
        ],
      }).required,
      modelUsageCostUsd: input.usageCost,
    };
  }
}

export function createRuntimeCorrectionTransport(): CorrectionTransportPort {
  const adapter = getCorrectionProviderAdapter('OPENROUTER_CHAT');
  const profile = {
    ...PROMOTED_CORRECTION_IDENTITY.requestProfile,
    routeProviders: [...PROMOTED_CORRECTION_IDENTITY.requestProfile.routeProviders],
  };
  return {
    async execute(input) {
      const result = await adapter.execute({
        apiKey: input.apiKey,
        jsonSchema: input.jsonSchema,
        messages: input.messages,
        modelId: input.modelId,
        profile,
      });
      return {
        latencyMs: result.latencyMs,
        output: result.output,
        providerRequestId: result.providerRequestId,
        usage: result.usage,
      };
    },
  };
}
