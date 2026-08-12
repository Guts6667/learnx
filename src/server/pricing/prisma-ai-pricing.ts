import {
  AiPricingCatalogStatus,
  type AiPricingQuote,
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { getCorrectionContractRuntimeEligibility } from '../../lib/ai-correction-contracts.js';
import { toIntlLocale } from '../../shared/locale.js';
import {
  AI_PRICING_ACTIONS,
  AiPricingError,
  type AiPricingQuoteRepository,
  type AiPricingTarget,
  type CreatePricingQuoteRecordInput,
  type PricingCatalogSnapshot,
  type PricingEntrySnapshot,
  type PricingTargetSnapshot,
  type StoredPricingQuote,
} from './ai-pricing.js';

function pricingAction(value: string): PricingEntrySnapshot['action'] {
  const action = AI_PRICING_ACTIONS.find((candidate) => candidate === value);
  if (!action) throw new AiPricingError('ACTION_UNAVAILABLE');
  return action;
}

function coefficientBasisPoints(value: Prisma.Decimal): bigint {
  const scaled = value.mul(10_000);
  if (!scaled.isInteger()) throw new AiPricingError('INVALID_CATALOG_METRICS');
  return BigInt(scaled.toFixed(0));
}

function catalogSnapshot(input: {
  benchmarkId: string;
  corpusId: string;
  currency: 'LEARNX_CREDIT';
  id: string;
  language: string;
  modelId: string;
  promptVersion: string;
  provider: string;
  providerRateCardEffectiveAt: Date | null;
  providerRateCardVersion: string | null;
  quoteTtlSeconds: number;
  usesPromotionalProviderRates: boolean;
  version: string;
}): PricingCatalogSnapshot {
  return input;
}

function entrySnapshot(input: {
  action: string;
  catalogVersionId: string;
  feeCredits: bigint;
  floorCredits: bigint;
  id: string;
  includesAutomaticSecondPass: boolean;
  inputSizeClass: PricingEntrySnapshot['inputSizeClass'];
  providerMedianCostCredits: bigint;
  providerMedianCostUsd: Prisma.Decimal;
  providerP90CostCredits: bigint;
  providerP90CostUsd: Prisma.Decimal;
  safetyCoefficient: Prisma.Decimal;
  targetMarginCredits: bigint;
}): PricingEntrySnapshot {
  return {
    ...input,
    action: pricingAction(input.action),
    providerMedianCostUsd: input.providerMedianCostUsd.toFixed(8),
    providerP90CostUsd: input.providerP90CostUsd.toFixed(8),
    safetyCoefficientBasisPoints: coefficientBasisPoints(
      input.safetyCoefficient,
    ),
  };
}

function storedQuote(quote: AiPricingQuote): StoredPricingQuote {
  return {
    action: pricingAction(quote.action),
    catalogVersionId: quote.catalogVersionId,
    ceilingCredits: quote.ceilingCredits,
    contractKey: quote.contractKey,
    contractVersion: quote.contractVersion,
    createdAt: quote.createdAt,
    estimatedCredits: quote.estimatedCredits,
    expiresAt: quote.expiresAt,
    floorCredits: quote.floorCredits,
    id: quote.id,
    includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
    inputSizeClass: quote.inputSizeClass,
    language: quote.language,
    modelId: quote.modelId,
    promptVersion: quote.promptVersion,
    requestFingerprint: quote.requestFingerprint,
    target: { id: quote.targetId, kind: quote.targetKind },
    userId: quote.userId,
  };
}

function targetSnapshot(input: {
  contract: unknown;
  content: string | null;
  locale: string;
  target: AiPricingTarget;
}): PricingTargetSnapshot {
  const eligibility = getCorrectionContractRuntimeEligibility(input.contract);
  if (!eligibility.eligible) throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  return {
    contract: eligibility.contract,
    inputChars: input.content?.length ?? 0,
    language: toIntlLocale(input.locale === 'en' ? 'en' : 'fr'),
    target: input.target,
  };
}

export class PrismaAiPricingQuoteRepository
  implements AiPricingQuoteRepository
{
  public constructor(private readonly prisma: PrismaClient) {}

  public async resolveTarget(
    userId: string,
    target: AiPricingTarget,
  ): Promise<PricingTargetSnapshot | null> {
    if (target.kind === 'EXERCISE_SUBMISSION') {
      const submission = await this.prisma.exerciseSubmission.findFirst({
        where: { id: target.id, userId, status: { not: 'DRAFT' } },
        select: {
          contentMarkdown: true,
          exercise: {
            select: {
              rubric: true,
              lesson: {
                select: {
                  module: {
                    select: { stage: { select: { program: { select: { locale: true } } } } },
                  },
                },
              },
            },
          },
        },
      });
      return submission
        ? targetSnapshot({
            content: submission.contentMarkdown,
            contract: submission.exercise.rubric,
            locale: submission.exercise.lesson.module.stage.program.locale,
            target,
          })
        : null;
    }

    const submission = await this.prisma.stageAssessmentSubmission.findFirst({
      where: { id: target.id, userId, status: { not: 'DRAFT' } },
      select: {
        contentMarkdown: true,
        stageAssessment: {
          select: {
            rubric: true,
            stage: { select: { program: { select: { locale: true } } } },
          },
        },
      },
    });
    return submission
      ? targetSnapshot({
          content: submission.contentMarkdown,
          contract: submission.stageAssessment.rubric,
          locale: submission.stageAssessment.stage.program.locale,
          target,
        })
      : null;
  }

  public async findActiveEntry(input: Parameters<AiPricingQuoteRepository['findActiveEntry']>[0]) {
    const entries = await this.prisma.aiPricingCatalogEntry.findMany({
      where: {
        action: input.action,
        status: AiPricingCatalogStatus.ACTIVE,
        minInputChars: { lte: input.inputChars },
        OR: [{ maxInputChars: null }, { maxInputChars: { gte: input.inputChars } }],
        catalogVersion: {
          status: AiPricingCatalogStatus.ACTIVE,
          language: input.language,
          effectiveAt: { lte: input.now },
        },
      },
      include: { catalogVersion: true },
    });
    if (entries.length === 0) return null;
    if (entries.length !== 1) throw new AiPricingError('INVALID_CATALOG_METRICS');
    const [entry] = entries;
    if (!entry) throw new AiPricingError('INVALID_CATALOG_METRICS');
    return {
      catalog: catalogSnapshot(entry.catalogVersion),
      entry: entrySnapshot(entry),
    };
  }

  public async createQuote(
    input: CreatePricingQuoteRecordInput,
  ): Promise<StoredPricingQuote> {
    const quote = await this.prisma.aiPricingQuote.create({
      data: {
        action: input.entry.action,
        catalogEntryId: input.entry.id,
        catalogVersionId: input.catalog.id,
        ceilingCredits: input.price.ceilingCredits,
        contractKey: input.target.contract.contractKey,
        contractVersion: input.target.contract.version,
        estimatedCredits: input.price.estimatedCredits,
        expiresAt: input.expiresAt,
        feeCreditsSnapshot: input.entry.feeCredits,
        floorCredits: input.price.floorCredits,
        idempotencyKey: input.idempotencyKey,
        includesAutomaticSecondPass: input.entry.includesAutomaticSecondPass,
        inputChars: input.inputChars,
        inputSizeClass: input.entry.inputSizeClass,
        language: input.catalog.language,
        modelId: input.catalog.modelId,
        promptVersion: input.catalog.promptVersion,
        provider: input.catalog.provider,
        providerMedianCostUsdSnapshot: input.entry.providerMedianCostUsd,
        providerMedianCreditsSnapshot: input.entry.providerMedianCostCredits,
        providerP90CostUsdSnapshot: input.entry.providerP90CostUsd,
        providerP90CreditsSnapshot: input.entry.providerP90CostCredits,
        requestFingerprint: input.requestFingerprint,
        safetyCoefficientSnapshot:
          Number(input.entry.safetyCoefficientBasisPoints) / 10_000,
        targetId: input.target.target.id,
        targetKind: input.target.target.kind,
        targetMarginCreditsSnapshot: input.entry.targetMarginCredits,
        userId: input.userId,
      },
    });
    return storedQuote(quote);
  }

  public async findQuoteByIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<StoredPricingQuote | null> {
    const quote = await this.prisma.aiPricingQuote.findUnique({
      where: { userId_idempotencyKey: { idempotencyKey, userId } },
    });
    return quote ? storedQuote(quote) : null;
  }

  public async isQuoteCurrentlyCompatible(
    quote: StoredPricingQuote,
    now: Date,
  ): Promise<boolean> {
    return (
      (await this.prisma.aiPricingCatalogEntry.count({
        where: {
          action: quote.action,
          catalogVersionId: quote.catalogVersionId,
          inputSizeClass: quote.inputSizeClass,
          status: AiPricingCatalogStatus.ACTIVE,
          catalogVersion: {
            effectiveAt: { lte: now },
            language: quote.language,
            modelId: quote.modelId,
            promptVersion: quote.promptVersion,
            status: AiPricingCatalogStatus.ACTIVE,
          },
        },
      })) === 1
    );
  }
}
