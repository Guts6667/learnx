import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  AI_PRICING_ACTIONS,
  AiPricingError,
  AiPricingQuoteService,
  type AiPricingQuoteRepository,
} from '../../pricing/ai-pricing.js';
import { PrismaAiPricingQuoteRepository } from '../../pricing/prisma-ai-pricing.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';

const AI_PRICING_QUOTE_PATH = '/api/ai-correction/quotes';

const requestSchema = z
  .object({
    action: z.enum(AI_PRICING_ACTIONS),
    idempotencyKey: z.string().min(8).max(200),
    target: z.discriminatedUnion('kind', [
      z
        .object({ id: z.uuid(), kind: z.literal('EXERCISE_SUBMISSION') })
        .strict(),
      z
        .object({
          id: z.uuid(),
          kind: z.literal('STAGE_ASSESSMENT_SUBMISSION'),
        })
        .strict(),
    ]),
  })
  .strict();

export interface AiPricingAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  authorization?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: AiPricingQuoteRepository;
  service?: Pick<AiPricingQuoteService, 'quote'>;
}

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function pricingApiError(error: AiPricingError): ApiError {
  switch (error.code) {
    case 'CATALOG_UNAVAILABLE':
    case 'ACTION_UNAVAILABLE':
      return new ApiError(
        'PRICING_UNAVAILABLE',
        'Estimation unavailable. No correction will be started.',
        503,
      );
    case 'TARGET_NOT_FOUND':
      return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
    case 'TARGET_NOT_ELIGIBLE':
      return new ApiError(
        'AI_CORRECTION_NOT_ELIGIBLE',
        'This submission is not eligible for AI correction.',
        409,
      );
    case 'DUPLICATE_OPERATION_CONFLICT':
      return new ApiError(
        'PRICING_QUOTE_CONFLICT',
        'This idempotency key already identifies a different quote request.',
        409,
      );
    case 'QUOTE_EXPIRED':
    case 'QUOTE_INCOMPATIBLE':
      return new ApiError(
        'PRICING_QUOTE_EXPIRED',
        'This quote is no longer valid. Request a new quote.',
        409,
      );
    default:
      return invalidRequest();
  }
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

async function defaultRepository(): Promise<AiPricingQuoteRepository> {
  const { prisma } = await import('../../prisma.js');
  return new PrismaAiPricingQuoteRepository(prisma);
}

export function createAiPricingApp(options: AiPricingAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  let repository: AiPricingQuoteRepository | undefined = options.repository;
  let service = options.service;

  app.use(AI_PRICING_QUOTE_PATH, options.authentication ?? requireUser);
  app.use(
    AI_PRICING_QUOTE_PATH,
    options.authorization ?? requireCapability('ai.assessment.correct'),
  );
  app.onError((error, context) => {
    const apiError =
      error instanceof AiPricingError
        ? pricingApiError(error)
        : error instanceof ApiError
          ? error
          : new ApiError(
              'INTERNAL_ERROR',
              'An unexpected error occurred.',
              500,
            );
    return context.json(toApiErrorBody(apiError), apiError.status);
  });

  app.post(AI_PRICING_QUOTE_PATH, async (context) => {
    const parsed = requestSchema.safeParse(await parseJson(context.req.raw));
    if (!parsed.success) throw invalidRequest();
    if (!service) {
      repository ??= await defaultRepository();
      service = new AiPricingQuoteService(repository, options.now);
    }
    const quote = await service.quote({
      ...parsed.data,
      userId: context.get('user').id,
    });

    return context.json(
      {
        resource: {
          quote: {
            action: quote.action,
            currency: 'LEARNX_CREDIT',
            estimatedCredits: quote.estimatedCredits.toString(),
            expiresAt: quote.expiresAt.toISOString(),
            id: quote.id,
            includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
            includesTargetedVerification: quote.includesTargetedVerification,
            maximumReservedCredits: quote.ceilingCredits.toString(),
            releasePolicy: 'ACCEPTED_QUOTE_PRICE',
            scope:
              quote.action === 'RECONSIDERATION'
                ? 'RECONSIDERATION'
                : 'PRIMARY',
          },
        },
      },
      201,
    );
  });

  return app;
}

export const aiPricingApp = createAiPricingApp();
