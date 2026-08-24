import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, type ApiErrorCode } from '../_lib/errors.js';

import {
  CorrectionOrchestrationError,
  CorrectionOrchestrationService,
} from '../../corrections/correction-orchestration.ts';

const runCorrectionRequestSchema = z
  .object({
    quoteId: z.string().uuid(),
  })
  .strict();

export interface CorrectionsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  authorization?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  orchestration?: Pick<CorrectionOrchestrationService, 'runAcceptedQuote'>;
}

export function createCorrectionsApp(options: CorrectionsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();

  app.use('*', options.authentication ?? requireUser);
  app.use(
    '*',
    options.authorization ?? requireCapability('ai.assessment.correct'),
  );

  app.post('/ai-corrections', async (context) => {
    const parsed = runCorrectionRequestSchema.safeParse(
      await context.req.raw.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }
    if (!options.orchestration) {
      throw new ApiError(
        'AI_CORRECTION_UNAVAILABLE',
        'AI correction is not configured on this deployment.',
        503,
      );
    }

    try {
      const result = await options.orchestration.runAcceptedQuote({
        quoteId: parsed.data.quoteId,
        userId: context.get('user').id,
      });
      return context.json({ resource: { correction: result } }, 201);
    } catch (error) {
      if (error instanceof CorrectionOrchestrationError) {
        const mapping: Record<string, { code: ApiErrorCode; status: 409 | 404 | 503 }> = {
          INSUFFICIENT_CREDITS: { code: 'INSUFFICIENT_CREDITS', status: 409 },
          QUOTE_EXPIRED: { code: 'PRICING_QUOTE_EXPIRED', status: 409 },
          QUOTE_INCOMPATIBLE: { code: 'PRICING_QUOTE_CONFLICT', status: 409 },
          QUOTE_NOT_ACTIVE: { code: 'PRICING_QUOTE_CONFLICT', status: 409 },
          QUOTE_ALREADY_CONSUMED: {
            code: 'PRICING_QUOTE_CONFLICT',
            status: 409,
          },
          QUOTE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', status: 404 },
        };
        const mapped: { code: ApiErrorCode; status: 409 | 404 | 503 } =
          mapping[error.code] ?? {
            code: 'AI_CORRECTION_UNAVAILABLE',
            status: 503,
          };
        throw new ApiError(
          mapped.code,
          'The correction could not run.',
          mapped.status,
        );
      }
      throw error;
    }
  });

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    }
    return context.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Unexpected error.' } },
      500,
    );
  });

  return app;
}

export const correctionsApp = createCorrectionsApp();
