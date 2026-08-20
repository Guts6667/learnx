import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { loadEvidenceAssistPilotBinding } from '../../ai/evidence-assist-pilot-binding.js';
import { DeterministicV4010FakeProvider } from '../../ai/v4-010-fake-provider.js';
import {
  createFormativeCorrectionFakeFlow,
  FormativeCorrectionFakeFlowService,
  FormativeCorrectionFlowError,
} from '../../formative-correction/fake-flow.js';
import { PrismaFormativeCorrectionRepository } from '../../formative-correction/prisma-fake-flow-repository.js';

const identifierSchema = z.uuid();
const SUBMISSION_CORRECTIONS_PATH =
  '/api/exercise-submissions/:submissionId/formative-corrections';
const RETRY_PATH = '/api/formative-corrections/:correctionId/retry';
const requestSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(200),
    responseText: z.string().min(1).max(100_000),
  })
  .strict();

interface FormativeCorrectionsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  enabled?: boolean;
  service?: FormativeCorrectionFakeFlowService;
}

export function isV4010FakeFlowEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.LEARNX_V4_010_FAKE_FLOW === 'true'
  );
}

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function parseIdentifier(value: string): string {
  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest();
  return parsed.data;
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

function mapFlowError(error: FormativeCorrectionFlowError): ApiError {
  if (
    error.code === 'SUBMISSION_NOT_FOUND' ||
    error.code === 'SUBMISSION_NOT_ELIGIBLE' ||
    error.code === 'FEATURE_DISABLED'
  ) {
    return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
  }
  if (
    error.code === 'IDEMPOTENCY_CONFLICT' ||
    error.code === 'CORRECTION_NOT_RETRYABLE' ||
    error.code === 'INITIAL_RESPONSE_MUST_MATCH_SUBMISSION'
  ) {
    return new ApiError('INVALID_SUBMISSION_STATE', error.code, 409);
  }
  return invalidRequest();
}

async function createDefaultService(): Promise<FormativeCorrectionFakeFlowService> {
  const [{ prisma }] = await Promise.all([import('../../prisma.js')]);
  const pilot = loadEvidenceAssistPilotBinding({
    bindingPath:
      'benchmarks/ai-correction/executable-rubric/writing-go-no-go-recommendation-fr.v2.binding.json',
  });
  return createFormativeCorrectionFakeFlow({
    bindingTarget: pilot.binding.target,
    compiled: pilot.compiledRubric,
    provider: new DeterministicV4010FakeProvider(),
    repository: new PrismaFormativeCorrectionRepository(prisma),
  });
}

export function createFormativeCorrectionsApp(
  options: FormativeCorrectionsAppOptions = {},
) {
  const app = new Hono<AuthEnvironment>();
  const enabled = options.enabled ?? isV4010FakeFlowEnabled();
  let service = options.service;
  const getService = async () => {
    service ??= await createDefaultService();
    return service;
  };

  app.use(
    SUBMISSION_CORRECTIONS_PATH,
    options.authentication ?? requireUser,
  );
  app.use(
    SUBMISSION_CORRECTIONS_PATH,
    requireCapability('learning.read'),
  );
  app.use(
    RETRY_PATH,
    options.authentication ?? requireUser,
  );
  app.use(
    RETRY_PATH,
    requireCapability('learning.write.own'),
  );
  app.onError((error, context) => {
    const apiError =
      error instanceof FormativeCorrectionFlowError
        ? mapFlowError(error)
        : error instanceof ApiError
          ? error
          : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });

  app.get(
    SUBMISSION_CORRECTIONS_PATH,
    async (context) => {
      if (!enabled) {
        return context.json({
          flow: {
            corrections: [],
            enabled: false,
            simulation: null,
          },
        });
      }
      const submissionId = parseIdentifier(context.req.param('submissionId'));
      const history = await (
        await getService()
      ).history(submissionId, context.get('user').id);
      return context.json({ flow: history });
    },
  );

  app.post(
    SUBMISSION_CORRECTIONS_PATH,
    requireCapability('learning.write.own'),
    async (context) => {
      if (!enabled) {
        throw new FormativeCorrectionFlowError('FEATURE_DISABLED');
      }
      const submissionId = parseIdentifier(context.req.param('submissionId'));
      const parsed = requestSchema.safeParse(await parseJson(context.req.raw));
      if (!parsed.success) throw invalidRequest();
      const correction = await (
        await getService()
      ).request({
        ...parsed.data,
        submissionId,
        userId: context.get('user').id,
      });
      return context.json({ correction }, 201);
    },
  );

  app.post(
    RETRY_PATH,
    async (context) => {
      if (!enabled) {
        throw new FormativeCorrectionFlowError('FEATURE_DISABLED');
      }
      const correctionId = parseIdentifier(context.req.param('correctionId'));
      const correction = await (
        await getService()
      ).retry(correctionId, context.get('user').id);
      return context.json({ correction });
    },
  );

  return app;
}

export const formativeCorrectionsApp = createFormativeCorrectionsApp();
