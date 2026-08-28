import {
  AiPricingCatalogStatus,
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { PROMOTED_CORRECTION_IDENTITY } from '../corrections/promoted-identity.js';
import {
  AiPricingError,
  type AiPricingQuoteRepository,
  type AiPricingTarget,
  type CreatePricingQuoteRecordInput,
  type StoredPricingQuote,
} from './ai-pricing.js';
import {
  asPricingJson,
  catalogSnapshot,
  entrySnapshot,
  storedQuote,
} from './prisma-ai-pricing-mappers.js';
import { resolvePricingTarget } from './prisma-ai-pricing-targets.js';

export class PrismaAiPricingQuoteRepository implements AiPricingQuoteRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public resolveTarget(userId: string, target: AiPricingTarget) {
    return resolvePricingTarget(this.prisma, userId, target);
  }

  public async findActiveEntry(
    input: Parameters<AiPricingQuoteRepository['findActiveEntry']>[0],
  ) {
    const entries = await this.prisma.aiPricingCatalogEntry.findMany({
      where: {
        action: input.action,
        status: AiPricingCatalogStatus.ACTIVE,
        minInputChars: { lte: input.inputChars },
        OR: [
          { maxInputChars: null },
          { maxInputChars: { gte: input.inputChars } },
        ],
        catalogVersion: {
          status: AiPricingCatalogStatus.ACTIVE,
          language: input.language,
          effectiveAt: { lte: input.now },
        },
      },
      include: { catalogVersion: true },
    });
    if (entries.length === 0) return null;
    if (entries.length !== 1)
      throw new AiPricingError('INVALID_CATALOG_METRICS');
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
        costDimensionsSnapshot:
          input.catalog.costDimensions === null
            ? Prisma.JsonNull
            : asPricingJson(input.catalog.costDimensions),
        estimatedCredits: input.price.estimatedCredits,
        expiresAt: input.expiresAt,
        feeCreditsSnapshot: input.entry.feeCredits,
        floorCredits: input.price.floorCredits,
        idempotencyKey: input.idempotencyKey,
        includesAutomaticSecondPass: input.entry.includesAutomaticSecondPass,
        includesTargetedVerification: input.entry.includesTargetedVerification,
        inputChars: input.inputChars,
        inputSizeClass: input.entry.inputSizeClass,
        language: input.catalog.language,
        modelId: input.catalog.modelId,
        pipelineIdentitySnapshot:
          input.catalog.pipelineIdentitySnapshot === null
            ? Prisma.JsonNull
            : asPricingJson(input.catalog.pipelineIdentitySnapshot),
        pipelineVersionId: input.catalog.pipelineVersionId,
        promptVersion: input.catalog.promptVersion,
        provider: input.catalog.provider,
        providerMedianCostUsdSnapshot: input.entry.providerMedianCostUsd,
        providerMedianCreditsSnapshot: input.entry.providerMedianCostCredits,
        providerP90CostUsdSnapshot: input.entry.providerP90CostUsd,
        providerP90CreditsSnapshot: input.entry.providerP90CostCredits,
        requestFingerprint: input.requestFingerprint,
        reconsiderationArgument: input.target.reconsideration?.argument ?? null,
        reconsiderationOfCorrectionId:
          input.target.reconsideration?.sourceCorrectionId ?? null,
        safetyCoefficientSnapshot:
          Number(input.entry.safetyCoefficientBasisPoints) / 10_000,
        targetId: input.target.target.id,
        targetKind: input.target.target.kind,
        targetMarginCreditsSnapshot: input.entry.targetMarginCredits,
        userId: input.userId,
        workflowKind: input.catalog.workflowKind,
      },
    });
    return storedQuote(quote);
  }

  public async findQuoteByIdempotency(userId: string, idempotencyKey: string) {
    const quote = await this.prisma.aiPricingQuote.findUnique({
      where: { userId_idempotencyKey: { idempotencyKey, userId } },
    });
    return quote ? storedQuote(quote) : null;
  }

  public async findQuoteById(userId: string, quoteId: string) {
    const quote = await this.prisma.aiPricingQuote.findFirst({
      where: { id: quoteId, userId },
    });
    return quote ? storedQuote(quote) : null;
  }

  public async isQuoteCurrentlyCompatible(
    quote: StoredPricingQuote,
    now: Date,
  ): Promise<boolean> {
    if (!quote.provider) return false;
    return (
      (await this.prisma.aiPricingCatalogEntry.count({
        where: {
          action: quote.action,
          catalogVersionId: quote.catalogVersionId,
          inputSizeClass: quote.inputSizeClass,
          includesTargetedVerification: quote.includesTargetedVerification,
          status: AiPricingCatalogStatus.ACTIVE,
          catalogVersion: {
            benchmarkId: PROMOTED_CORRECTION_IDENTITY.benchmarkId,
            effectiveAt: { lte: now },
            language: quote.language,
            modelId: quote.modelId,
            pipelineVersionId: quote.pipelineVersionId,
            promptVersion: quote.promptVersion,
            provider: quote.provider,
            status: AiPricingCatalogStatus.ACTIVE,
            workflowKind: quote.workflowKind,
          },
        },
      })) === 1
    );
  }
}
