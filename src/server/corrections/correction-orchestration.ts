import {
  buildProtocol3TransportJsonSchema,
  correctionContractSchema,
  deriveCorrectionSecondPassDecision,
  type CorrectionContract,
  type CorrectionOutput,
  type Protocol3CorrectionArtifactOutput,
} from '../../lib/ai-correction-contracts.js';
import {
  getCorrectionProviderAdapter,
} from '../../lib/ai-correction-provider-adapters.js';
import {
  reconcileProtocol3ScoreGuardPasses,
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '../../lib/ai-correction-benchmark.js';
import { sanitizeStructuredOutputJsonSchema } from '../../lib/ai-json-schema.js';

import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';
import { buildRuntimeCorrectionMessages } from './runtime-correction-prompt.js';
import type { CorrectionMonitoringSignal } from './correction-monitoring.js';

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
  modelId: string;
  provider: string;
  includesAutomaticSecondPass: boolean;
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
}

export interface CorrectionTransportPort {
  execute(input: {
    apiKey: string;
    jsonSchema: Record<string, unknown>;
    messages: Array<{ content: string; role: 'system' | 'user' }>;
    modelId: string;
  }): Promise<{
    latencyMs: number;
    modelSnapshot: string;
    output: unknown;
    providerRequestId?: string;
    providerRoute: string;
    usage: {
      actualCostUsd?: number;
      inputTokens: number;
      reasoningTokens: number;
      visibleOutputTokens: number;
    };
  }>;
}

export interface RuntimeCorrectionAttempt {
  actualCostUsd?: number;
  errorCode?: string;
  inputTokens?: number;
  latencyMs?: number;
  modelSnapshot?: string;
  output?: unknown;
  providerRequestId?: string;
  providerRoute?: string;
  reasoningTokens?: number;
  sequence: number;
  status: 'FAILED' | 'SUCCEEDED';
  visibleOutputTokens?: number;
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
    monitoringSignals: CorrectionMonitoringSignal[];
  };
  settlement: {
    reservedCredits: string;
    settledCredits: string;
    releasedCredits: string;
  };
  replay: boolean;
}

// L'identité writing-only interdit les retries/fallbacks. Une seconde
// exécution reste possible uniquement lorsque la bande de garde l'impose.
const MAX_RUNTIME_PRIMARY_ATTEMPTS =
  PROMOTED_CORRECTION_IDENTITY.maxRetries + 1;

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
        attempts: RuntimeCorrectionAttempt[];
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

    const contract = correctionContractSchema.parse(quote.contract);
    // Scope vendu = scope promu. Le refus a lieu avant replay et réservation :
    // défaut éliminatoire Practice confirmé par la revue du 24 août.
    if (
      !PROMOTED_CORRECTION_IDENTITY.activityTypeScope.some(
        (activityType) => activityType === contract.target.activityType,
      ) ||
      quote.contractKey !== contract.contractKey ||
      quote.contractVersion !== contract.version ||
      quote.modelId !== PROMOTED_CORRECTION_IDENTITY.modelId ||
      quote.provider !== PROMOTED_CORRECTION_IDENTITY.provider ||
      quote.promptVersion !== PROMOTED_CORRECTION_IDENTITY.promptVersion ||
      !quote.includesAutomaticSecondPass
    ) {
      throw new CorrectionOrchestrationError('QUOTE_INCOMPATIBLE');
    }

    const replayed = await this.corrections.findByQuote({
      requestFingerprint: quote.requestFingerprint,
      userId: input.userId,
    });
    if (replayed) {
      return replayed;
    }

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
    const execution = await this.executeCorrection({ contract, quote });

    const persisted = await this.corrections.persist({
      attempts: execution.attempts,
      quote,
      result: execution.correction,
      userId: input.userId,
    });
    const correction = { ...execution.correction, id: persisted.id };
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
    // PrismaCreditLedger.settle restitue atomiquement la part non consommée
    // de la réservation. Un release après settlement tenterait de finaliser
    // deux fois la même réservation et échouerait en production.
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
  }): Promise<{
    attempts: RuntimeCorrectionAttempt[];
    correction: OrchestratedCorrectionResult['correction'];
  }> {
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
    const attempts: RuntimeCorrectionAttempt[] = [];
    for (
      let attempt = 1;
      attempt <= MAX_RUNTIME_PRIMARY_ATTEMPTS;
      attempt += 1
    ) {
      let generation;
      try {
        generation = await this.transport.execute({
          apiKey: this.options.apiKey,
          jsonSchema,
          messages,
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
        });
      } catch (error) {
        attempts.push({
          errorCode: error instanceof Error ? error.message : 'TRANSPORT_ERROR',
          sequence: attempts.length + 1,
          status: 'FAILED',
        });
        continue;
      }
      usageCost += generation.usage.actualCostUsd ?? 0;
      const primary = this.resolveRuntimeGeneration({
        contract: input.contract,
        output: generation.output,
        responseText: input.quote.submissionText,
      });
      attempts.push(
        this.runtimeAttemptSnapshot({
          generation,
          sequence: attempts.length + 1,
          valid: primary !== null,
        }),
      );
      if (!primary) {
        continue;
      }
      const primaryScore =
        primary.unsureCriteria.length === 0
          ? weightedIndicativeScore(input.contract, primary.output)
          : null;
      const guarded =
        primaryScore !== null &&
        Math.abs(primaryScore - input.contract.passingScore) <=
          PROMOTED_CORRECTION_IDENTITY.scoreGuardBandPoints;
      if (!guarded) {
        return {
          attempts,
          correction: this.toOutcome({
            contract: input.contract,
            output: primary.output,
            unsureCriteria: primary.unsureCriteria,
            usageCost,
          }),
        };
      }

      // La seconde passe utilise le même modèle épinglé et le même
      // workflow. Ce n'est ni un retry ni un fallback fournisseur. Seuls les
      // critères dont les niveaux concordent restent publiables.
      let second: ReturnType<
        CorrectionOrchestrationService['resolveRuntimeGeneration']
      > = null;
      try {
        const secondGeneration = await this.transport.execute({
          apiKey: this.options.apiKey,
          jsonSchema,
          messages,
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
        });
        usageCost += secondGeneration.usage.actualCostUsd ?? 0;
        second = this.resolveRuntimeGeneration({
          contract: input.contract,
          output: secondGeneration.output,
          responseText: input.quote.submissionText,
        });
        attempts.push(
          this.runtimeAttemptSnapshot({
            generation: secondGeneration,
            sequence: attempts.length + 1,
            valid: second !== null,
          }),
        );
      } catch (error) {
        attempts.push({
          errorCode: error instanceof Error ? error.message : 'TRANSPORT_ERROR',
          sequence: attempts.length + 1,
          status: 'FAILED',
        });
        // Aucun retry/fallback ne suit. Sans seconde passe valide, aucun
        // critère ne peut être déclaré concordant.
      }
      const reconciled = second
        ? reconcileProtocol3ScoreGuardPasses({
            contract: input.contract,
            primary,
            second,
          })
        : null;
      if (!reconciled?.output) {
        return {
          attempts,
          correction: {
            id: '',
            status: 'FAILED',
            criteria: [],
            unsureCriteria: input.contract.criteria.map(
              (criterion) => criterion.key,
            ),
            overallFeedback: null,
            indicativeScore: null,
            secondPassRequired: true,
            modelUsageCostUsd: usageCost,
            monitoringSignals: ['SCORE_GUARD_TRIGGERED'],
          },
        };
      }
      return {
        attempts,
        correction: this.toOutcome({
          contract: input.contract,
          forceScoreGuardSecondPass: true,
          output: reconciled.output,
          unsureCriteria: reconciled.unsureCriteria,
          usageCost,
        }),
      };
    }
    return {
      attempts,
      correction: {
        id: '',
        status: 'FAILED',
        criteria: [],
        unsureCriteria: [],
        overallFeedback: null,
        indicativeScore: null,
        secondPassRequired: false,
        modelUsageCostUsd: usageCost,
        monitoringSignals: [],
      },
    };
  }

  private runtimeAttemptSnapshot(input: {
    generation: Awaited<ReturnType<CorrectionTransportPort['execute']>>;
    sequence: number;
    valid: boolean;
  }): RuntimeCorrectionAttempt {
    return {
      ...(input.generation.usage.actualCostUsd === undefined
        ? {}
        : { actualCostUsd: input.generation.usage.actualCostUsd }),
      ...(input.valid ? {} : { errorCode: 'MODEL_OUTPUT_INVALID' }),
      inputTokens: input.generation.usage.inputTokens,
      latencyMs: input.generation.latencyMs,
      modelSnapshot: input.generation.modelSnapshot,
      output: input.generation.output,
      ...(input.generation.providerRequestId === undefined
        ? {}
        : { providerRequestId: input.generation.providerRequestId }),
      providerRoute: input.generation.providerRoute,
      reasoningTokens: input.generation.usage.reasoningTokens,
      sequence: input.sequence,
      status: input.valid ? 'SUCCEEDED' : 'FAILED',
      visibleOutputTokens: input.generation.usage.visibleOutputTokens,
    };
  }

  private resolveRuntimeGeneration(input: {
    contract: CorrectionContract;
    output: unknown;
    responseText: string;
  }): {
    output: Protocol3CorrectionArtifactOutput;
    unsureCriteria: string[];
  } | null {
    try {
      const strict = validateBenchmarkProtocol3ModelOutputWithEvidence({
        benchmarkCase: { responseText: input.responseText },
        contract: input.contract,
        output: input.output,
      });
      return { output: strict.output, unsureCriteria: [] };
    } catch {
      // Le contrat de preuve exacte et le prompt épinglé forment la
      // frontière déterministe avant tentative de livraison partielle.
    }
    try {
      const salvaged = salvageProtocol3PartialCorrection({
        benchmarkCase: { responseText: input.responseText },
        contract: input.contract,
        output: input.output,
      });
      return {
        output: salvaged.output,
        unsureCriteria: salvaged.unsureCriteria,
      };
    } catch {
      return null;
    }
  }

  private toOutcome(input: {
    contract: CorrectionContract;
    forceScoreGuardSecondPass?: boolean;
    output: Protocol3CorrectionArtifactOutput;
    unsureCriteria: string[];
    usageCost: number;
  }): OrchestratedCorrectionResult['correction'] {
    const deliveredAll = input.unsureCriteria.length === 0;
    const score = deliveredAll
      ? weightedIndicativeScore(input.contract, input.output)
      : null;
    const scoreGuardBandRequiresSecondPass =
      input.forceScoreGuardSecondPass === true ||
      (score !== null &&
        Math.abs(score - input.contract.passingScore) <=
          PROMOTED_CORRECTION_IDENTITY.scoreGuardBandPoints);
    const secondPassRequired =
      scoreGuardBandRequiresSecondPass ||
      deriveCorrectionSecondPassDecision({
        contract: input.contract,
        evaluations: [input.output as unknown as CorrectionOutput],
      }).required;
    const monitoringSignals: CorrectionMonitoringSignal[] = [];
    if (scoreGuardBandRequiresSecondPass) {
      monitoringSignals.push('SCORE_GUARD_TRIGGERED');
    }
    const hardConstraintLanguage =
      /\b(contrainte|interdit(?:e|es|s)?|violation|constraint|forbidden)\b/i;
    const hardConstraintMismatchSuspected = input.output.criteria.some(
      (criterion) => {
        if (!hardConstraintLanguage.test(criterion.feedback)) return false;
        const contractCriterion = input.contract.criteria.find(
          (candidate) => candidate.key === criterion.criterionKey,
        );
        const selected = contractCriterion?.performanceLevels.find(
          (level) => level.key === criterion.levelKey,
        );
        const minimum = contractCriterion?.performanceLevels.reduce(
          (lowest, level) => Math.min(lowest, level.score),
          Number.POSITIVE_INFINITY,
        );
        return (
          selected !== undefined &&
          minimum !== undefined &&
          selected.score > minimum
        );
      },
    );
    if (hardConstraintMismatchSuspected) {
      monitoringSignals.push('HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED');
    }
    return {
      id: '',
      status:
        deliveredAll && !scoreGuardBandRequiresSecondPass
          ? 'COMPLETED'
          : 'COMPLETED_PARTIAL',
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
      indicativeScore: scoreGuardBandRequiresSecondPass ? null : score,
      secondPassRequired,
      modelUsageCostUsd: input.usageCost,
      monitoringSignals,
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
        modelSnapshot: result.modelSnapshot,
        output: result.output,
        providerRequestId: result.providerRequestId,
        providerRoute: result.providerRoute,
        usage: result.usage,
      };
    },
  };
}
