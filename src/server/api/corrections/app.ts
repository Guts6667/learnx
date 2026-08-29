import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  readOpenRouterConfiguration,
  type OpenRouterConfiguration,
} from '../../ai/openrouter-configuration.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, type ApiErrorCode } from '../_lib/errors.js';

import {
  CorrectionOrchestrationError,
  CorrectionOrchestrationService,
  createRuntimeCorrectionTransport,
  type CorrectionHistoryEntry,
  type CreditSettlementPort,
  type OrchestratedCorrectionResult,
} from '../../corrections/correction-orchestration.js';
import { PrismaCorrectionOrchestrationPorts } from '../../corrections/prisma-correction-orchestration-store.js';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from '../../corrections/promoted-identity.js';
import { resolveCorrectionTransportMode } from '../../corrections/correction-transport-mode.js';
import { createRuntimeCorrectionChecker } from '../../corrections/correction-checker.js';
import {
  evaluateCorrectionReleasePreflight,
  type CorrectionReleasePreflight,
} from '../../corrections/release-preflight.js';
import { PrismaCreditLedger } from '../../credits/prisma-credit-ledger.js';
import {
  PrismaCorrectionMonitoringService,
  type CorrectionMonitoringSummary,
} from '../../corrections/correction-monitoring.js';

const runCorrectionRequestSchema = z
  .object({
    quoteId: z.string().uuid(),
  })
  .strict();

function serializeLearnerCorrectionResult(
  result: OrchestratedCorrectionResult,
) {
  const correction = {
    criteria: result.correction.criteria,
    id: result.correction.id,
    indicativeScore: result.correction.indicativeScore,
    overallConfidence: result.correction.overallConfidence,
    overallFeedback: result.correction.overallFeedback,
    secondPassRequired: result.correction.secondPassRequired,
    status: result.correction.status,
    unsureCriteria: result.correction.unsureCriteria,
    unsureCriterionDetails: result.correction.unsureCriterionDetails,
  };
  return {
    correction,
    replay: result.replay,
    settlement: result.settlement,
  };
}

function serializeLearnerCorrectionHistoryEntry(entry: CorrectionHistoryEntry) {
  return {
    action: entry.action ?? 'STANDARD',
    createdAt: entry.createdAt.toISOString(),
    sourceCorrectionId: entry.sourceCorrectionId ?? null,
    ...serializeLearnerCorrectionResult(entry.result),
  };
}

export interface CorrectionsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  authorization?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  orchestration?: Pick<CorrectionOrchestrationService, 'runAcceptedQuote'>;
  history?: {
    findLatestForSubmission(input: {
      submissionId: string;
      userId: string;
    }): Promise<OrchestratedCorrectionResult | null>;
    listForSubmission(input: {
      submissionId: string;
      userId: string;
    }): Promise<CorrectionHistoryEntry[]>;
  };
  monitoring?: { summary(): Promise<CorrectionMonitoringSummary> };
  preflight?: CorrectionReleasePreflight;
  resolveDefaultOrchestration?: () => Promise<Pick<
    CorrectionOrchestrationService,
    'runAcceptedQuote'
  > | null>;
}

function deploymentEnvironment(): 'development' | 'preview' | 'production' {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

export function isPromotedCorrectionConfiguration(
  configuration: OpenRouterConfiguration,
): boolean {
  const assignment = configuration.assignments.CORRECTION_PRIMARY;
  const secondPassAssignment = configuration.assignments.CORRECTION_SECOND_PASS;
  return Boolean(
    configuration.enabled &&
    !configuration.killSwitch &&
    configuration.apiKey &&
    assignment?.modelId === PROMOTED_CORRECTION_IDENTITY.modelId &&
    assignment.provider === PROMOTED_CORRECTION_IDENTITY.provider &&
    secondPassAssignment?.modelId === PROMOTED_CORRECTION_IDENTITY.modelId &&
    secondPassAssignment.provider === PROMOTED_CORRECTION_IDENTITY.provider,
  );
}

async function createDefaultOrchestration(): Promise<Pick<
  CorrectionOrchestrationService,
  'runAcceptedQuote'
> | null> {
  const configuration = readOpenRouterConfiguration({
    deploymentEnvironment: deploymentEnvironment(),
  });
  if (
    !isPromotedCorrectionConfiguration(configuration) ||
    !configuration.apiKey
  ) {
    return null;
  }

  const { prisma } = await import('../../prisma.js');
  const ports = new PrismaCorrectionOrchestrationPorts(prisma);
  const ledger = new PrismaCreditLedger(prisma);
  const credits: CreditSettlementPort = {
    async reserve(input) {
      const priorityLotIds = await ledger.offeredLotIds(input.userId);
      const result = await ledger.reserve({ ...input, priorityLotIds });
      if (!result.reservation) {
        throw new Error('CREDIT_RESERVATION_MISSING');
      }
      return { reservationId: result.reservation.id };
    },
    async settle(input) {
      await ledger.settle(input);
    },
    async release(input) {
      await ledger.release(input);
    },
  };

  return new CorrectionOrchestrationService(
    ports.quotes,
    credits,
    ports.corrections,
    createRuntimeCorrectionTransport(),
    {
      apiKey: configuration.apiKey,
      // Absent when the environment has no checker assigned: verdicts stay
      // UNAVAILABLE and corrections cap at MEDIUM rather than failing.
      ...(configuration.assignments.CORRECTION_CHECKER
        ? {
            checker: createRuntimeCorrectionChecker({
              apiKey: configuration.apiKey,
              appUrl: configuration.appUrl,
            }),
          }
        : {}),
    },
  );
}

export function createCorrectionsApp(options: CorrectionsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  let orchestration = options.orchestration;
  let monitoring = options.monitoring;
  let history = options.history;
  let defaultOrchestrationPromise:
    | Promise<Pick<CorrectionOrchestrationService, 'runAcceptedQuote'> | null>
    | undefined;

  app.use('*', options.authentication ?? requireUser);
  app.use(
    '*',
    options.authorization ?? requireCapability('ai.assessment.correct'),
  );

  app.get(
    '/api/admin/ai-corrections/preflight',
    requireCapability('credit.admin.manage'),
    (context) => {
      let preflight = options.preflight;
      if (!preflight) {
        try {
          preflight = evaluateCorrectionReleasePreflight(
            readOpenRouterConfiguration({
              deploymentEnvironment: deploymentEnvironment(),
            }),
            { transport: resolveCorrectionTransportMode() },
          );
        } catch {
          // Reached when the configuration itself refuses to parse, which
          // includes a fake transport asked for under production. Reporting
          // REAL here would be a lie in the one case that matters, but the
          // configuration is blocked either way, so nothing runs.
          preflight = {
            apiKeyPresent: false,
            checker: 'UNASSIGNED',
            checkerPromotedModelId: PROMOTED_CHECKER_IDENTITY.modelId,
            checkerScientificallyMeasured:
              PROMOTED_CHECKER_IDENTITY.promotion.scientific,
            deploymentEnvironment: deploymentEnvironment(),
            identityMatches: false,
            killSwitch: true,
            promotedBenchmarkId: PROMOTED_CORRECTION_IDENTITY.benchmarkId,
            state: 'CONFIGURATION_BLOCKED',
            transport: 'REAL',
          };
        }
      }
      return context.json({ preflight });
    },
  );

  app.get(
    '/api/exercise-submissions/:submissionId/ai-corrections',
    async (context) => {
      const submissionId = z
        .uuid()
        .safeParse(context.req.param('submissionId'));
      if (!submissionId.success) {
        throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
      }
      if (!history) {
        const { prisma } = await import('../../prisma.js');
        history = new PrismaCorrectionOrchestrationPorts(prisma);
      }
      const corrections = await history.listForSubmission({
        submissionId: submissionId.data,
        userId: context.get('user').id,
      });
      return context.json({
        resource: {
          corrections: corrections.map(serializeLearnerCorrectionHistoryEntry),
        },
      });
    },
  );

  app.get(
    '/api/admin/ai-corrections/monitoring',
    requireCapability('credit.admin.manage'),
    async (context) => {
      if (!monitoring) {
        const { prisma } = await import('../../prisma.js');
        monitoring = new PrismaCorrectionMonitoringService(prisma);
      }
      return context.json({ monitoring: await monitoring.summary() });
    },
  );

  app.get(
    '/api/exercise-submissions/:submissionId/ai-corrections/latest',
    async (context) => {
      const submissionId = z
        .uuid()
        .safeParse(context.req.param('submissionId'));
      if (!submissionId.success) {
        throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
      }
      if (!history) {
        const { prisma } = await import('../../prisma.js');
        history = new PrismaCorrectionOrchestrationPorts(prisma);
      }
      const correction = await history.findLatestForSubmission({
        submissionId: submissionId.data,
        userId: context.get('user').id,
      });
      return context.json({
        resource: {
          correction: correction
            ? serializeLearnerCorrectionResult(correction)
            : null,
        },
      });
    },
  );

  app.post('/api/ai-corrections', async (context) => {
    const parsed = runCorrectionRequestSchema.safeParse(
      await context.req.raw.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }
    if (!orchestration) {
      defaultOrchestrationPromise ??=
        options.resolveDefaultOrchestration?.() ?? createDefaultOrchestration();
      orchestration = (await defaultOrchestrationPromise) ?? undefined;
    }
    if (!orchestration) {
      throw new ApiError(
        'AI_CORRECTION_UNAVAILABLE',
        'AI correction is not configured on this deployment.',
        503,
      );
    }

    try {
      const result = await orchestration.runAcceptedQuote({
        quoteId: parsed.data.quoteId,
        userId: context.get('user').id,
      });
      return context.json(
        { resource: { correction: serializeLearnerCorrectionResult(result) } },
        201,
      );
    } catch (error) {
      if (error instanceof CorrectionOrchestrationError) {
        const mapping: Record<
          string,
          { code: ApiErrorCode; status: 409 | 404 | 503 }
        > = {
          INSUFFICIENT_CREDITS: { code: 'INSUFFICIENT_CREDITS', status: 409 },
          QUOTE_EXPIRED: { code: 'PRICING_QUOTE_EXPIRED', status: 409 },
          QUOTE_INCOMPATIBLE: { code: 'PRICING_QUOTE_CONFLICT', status: 409 },
          QUOTE_NOT_ACTIVE: { code: 'PRICING_QUOTE_CONFLICT', status: 409 },
          QUOTE_ALREADY_CONSUMED: {
            code: 'PRICING_QUOTE_CONFLICT',
            status: 409,
          },
          FINANCIAL_RECONCILIATION_REQUIRED: {
            code: 'AI_CORRECTION_UNAVAILABLE',
            status: 503,
          },
          QUOTE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', status: 404 },
        };
        const mapped: { code: ApiErrorCode; status: 409 | 404 | 503 } = mapping[
          error.code
        ] ?? {
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
