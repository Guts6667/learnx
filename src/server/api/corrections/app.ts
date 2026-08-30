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
  type CorrectionHistoryEntry,
  type CorrectionTransportPort,
  type CreditSettlementPort,
  type OrchestratedCorrectionResult,
} from '../../corrections/correction-orchestration.js';
import { PrismaCorrectionOrchestrationPorts } from '../../corrections/prisma-correction-orchestration-store.js';
import {
  PrismaCorrectionFeedbackRepository,
  type CorrectionFeedbackPort,
} from '../../corrections/prisma-correction-feedback.js';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from '../../corrections/promoted-identity.js';
import {
  selectCorrectionTransport,
  type CorrectionTransportSelection,
} from '../../corrections/correction-transport-mode.js';
import { createRuntimeCorrectionChecker } from '../../corrections/correction-checker.js';
import {
  evaluateCorrectionReleasePreflight,
  type CorrectionReleasePreflight,
} from '../../corrections/release-preflight.js';
import { PrismaCreditLedger } from '../../credits/prisma-credit-ledger.js';
import { ownerAlert } from '../../corrections/owner-alert.js';
import {
  PrismaCorrectionBreaker,
  type CorrectionBreakerPort,
} from '../../corrections/correction-breaker.js';
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
  feedback?: CorrectionFeedbackPort;
  breaker?: CorrectionBreakerPort;
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

async function createDefaultOrchestration(
  transport: CorrectionTransportPort,
): Promise<Pick<CorrectionOrchestrationService, 'runAcceptedQuote'> | null> {
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
    transport,
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
  // One decision, read by both the preflight and the orchestration, so the
  // reported transport is always the constructed transport.
  let breaker = options.breaker;
  let feedback = options.feedback;
  let selection: CorrectionTransportSelection | undefined;
  const transportSelection = (): CorrectionTransportSelection =>
    (selection ??= selectCorrectionTransport());
  let orchestration = options.orchestration;
  let monitoring = options.monitoring;
  let history = options.history;
  let defaultOrchestrationPromise:
    | Promise<Pick<CorrectionOrchestrationService, 'runAcceptedQuote'> | null>
    | undefined;

  // Scoped to the routes this app serves, never `*`: a wildcard guard runs for
  // every request reaching the app and so authenticates whatever is mounted
  // after it (V4.5-186). A route missing from this list is unguarded, and
  // `route-guards.test.ts` names it.
  const guardedPaths = [
    '/api/admin/ai-corrections/breaker/events',
    '/api/admin/ai-corrections/breaker/reopen',
    '/api/admin/ai-corrections/monitoring',
    '/api/admin/ai-corrections/preflight',
    '/api/ai-corrections',
    '/api/ai-corrections/:correctionId/feedback',
    '/api/exercise-submissions/:submissionId/ai-corrections',
    '/api/exercise-submissions/:submissionId/ai-corrections/latest',
  ] as const;

  for (const path of guardedPaths) {
    app.use(path, options.authentication ?? requireUser);
    app.use(
      path,
      options.authorization ?? requireCapability('ai.assessment.correct'),
    );
  }

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
            { transport: transportSelection().mode },
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
            promotedRequestProfileVersion:
              PROMOTED_CORRECTION_IDENTITY.requestProfile.version,
            state: 'CONFIGURATION_BLOCKED',
            transport: 'REAL',
          };
        }
      }
      return context.json({ preflight });
    },
  );

  const criterionFeedbackSchema = z
    .object({
      criterionKey: z.string().trim().min(1).max(120),
      verdict: z.enum(['HELPFUL', 'WRONG']),
    })
    .strict();

  app.post('/api/ai-corrections/:correctionId/feedback', async (context) => {
    const correctionId = z.uuid().safeParse(context.req.param('correctionId'));
    if (!correctionId.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }
    const body = criterionFeedbackSchema.safeParse(await context.req.json());
    if (!body.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }
    if (!feedback) {
      const { prisma } = await import('../../prisma.js');
      feedback = new PrismaCorrectionFeedbackRepository(prisma);
    }
    const recorded = await feedback.record({
      correctionId: correctionId.data,
      criterionKey: body.data.criterionKey,
      userId: context.get('user').id,
      verdict: body.data.verdict,
    });
    // A correction that is not the learner's answers 404: a forbidden would
    // confirm to a stranger that the id is real. A criterion the correction
    // never mentioned answers 422 instead — only its owner can ever reach that
    // branch, so telling them apart leaks nothing and says which is wrong.
    if (recorded.status === 'NOT_FOUND') {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Correction not found.', 404);
    }
    if (recorded.status === 'UNKNOWN_CRITERION') {
      throw new ApiError(
        'AI_CORRECTION_CRITERION_UNKNOWN',
        'Unknown criterion for this correction.',
        422,
      );
    }
    return context.json({
      resource: {
        feedback: {
          criterionKey: body.data.criterionKey,
          recordedAt: recorded.recordedAt.toISOString(),
          verdict: body.data.verdict,
        },
      },
    });
  });

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
      const userId = context.get('user').id;
      const corrections = await history.listForSubmission({
        submissionId: submissionId.data,
        userId,
      });
      if (!feedback) {
        const { prisma } = await import('../../prisma.js');
        feedback = new PrismaCorrectionFeedbackRepository(prisma);
      }
      const recorded = await feedback.listForCorrections({
        correctionIds: corrections.map((entry) => entry.result.correction.id),
        userId,
      });
      return context.json({
        resource: {
          corrections: corrections.map((entry) => ({
            ...serializeLearnerCorrectionHistoryEntry(entry),
            // Always present, empty when nothing was recorded. Absent would
            // mean "this API does not support feedback", which is what the
            // client keys its controls on; present-and-empty means "supported,
            // nothing said yet". The two must not look alike.
            criterionFeedback: recorded[entry.result.correction.id] ?? {},
          })),
        },
      });
    },
  );

  app.get(
    '/api/admin/ai-corrections/breaker/events',
    requireCapability('credit.admin.manage'),
    async (context) => {
      if (!breaker) {
        const { prisma } = await import('../../prisma.js');
        breaker = new PrismaCorrectionBreaker(prisma, ownerAlert());
      }
      // The journal is the audit: the current state says a guardrail is open,
      // this says when it tripped, on what number, whether the owner was told,
      // and who reopened it the last time. A state without a history cannot
      // answer whether this has happened before.
      return context.json({ resource: { events: await breaker.events() } });
    },
  );

  app.post(
    '/api/admin/ai-corrections/breaker/reopen',
    requireCapability('credit.admin.manage'),
    async (context) => {
      const body = z
        .object({ note: z.string().trim().min(1).max(500).optional() })
        .strict()
        .safeParse(await context.req.json().catch(() => ({})));
      if (!body.success) {
        throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
      }
      if (!breaker) {
        const { prisma } = await import('../../prisma.js');
        breaker = new PrismaCorrectionBreaker(prisma, ownerAlert());
      }
      // Reopening writes a line rather than clearing a flag, so who reopened a
      // tripped guardrail and why is recoverable afterwards. The quality
      // contract requires the reopen to be audited; append-only is how it is
      // audited rather than how it is promised to be.
      await breaker.reopen({
        actorId: context.get('user').id,
        ...(body.data.note === undefined ? {} : { note: body.data.note }),
      });
      return context.json({ resource: { breaker: await breaker.status() } });
    },
  );

  app.get(
    '/api/admin/ai-corrections/monitoring',
    requireCapability('credit.admin.manage'),
    async (context) => {
      if (!monitoring) {
        const { prisma } = await import('../../prisma.js');
        breaker ??= new PrismaCorrectionBreaker(prisma, ownerAlert());
        monitoring = new PrismaCorrectionMonitoringService(prisma, breaker);
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
        options.resolveDefaultOrchestration?.() ??
        createDefaultOrchestration(transportSelection().transport);
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
