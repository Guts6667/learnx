import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { CREDIT_OPERATION_REASON_MIN_LENGTH } from '../../../shared/credit-rules.js';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  type CreditAdministrationService,
  type CreditMemberDetail,
  type CreditMemberPage,
  type CreditProjection,
} from '../../credits/credit-administration.js';

async function defaultService(): Promise<CreditAdministrationService> {
  const [{ PrismaCreditAdministrationService }, { prisma }] = await Promise.all(
    [
      import('../../credits/credit-administration.js'),
      import('../../prisma.js'),
    ],
  );
  return new PrismaCreditAdministrationService(prisma);
}

const lazyCreditAdministrationService: CreditAdministrationService = {
  adjustFreeAllocation: async (input) =>
    (await defaultService()).adjustFreeAllocation(input),
  createIncreaseRequest: async (input) =>
    (await defaultService()).createIncreaseRequest(input),
  getMember: async (actorUserId, userId) =>
    (await defaultService()).getMember(actorUserId, userId),
  getOwnCredits: async (userId) =>
    (await defaultService()).getOwnCredits(userId),
  listMembers: async (input) => (await defaultService()).listMembers(input),
  listPolicies: async () => (await defaultService()).listPolicies(),
  reviewIncreaseRequest: async (input) =>
    (await defaultService()).reviewIncreaseRequest(input),
};

interface CreditsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  service?: CreditAdministrationService;
}

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(320).optional(),
});
const increaseRequestSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9._:-]{8,200}$/),
    reason: z
      .string()
      .trim()
      .min(CREDIT_OPERATION_REASON_MIN_LENGTH)
      .max(1_000),
  })
  .strict();
const adjustmentSchema = z
  .object({
    amount: z.string().regex(/^-?[1-9]\d*$/),
    compensatesEntryId: z.uuid().optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9._:-]{8,200}$/),
    reason: z.string().trim().min(CREDIT_OPERATION_REASON_MIN_LENGTH).max(500),
  })
  .strict()
  .superRefine((input, context) => {
    if (BigInt(input.amount) < 0n && !input.compensatesEntryId) {
      context.addIssue({
        code: 'custom',
        message: 'A compensating entry is required for a reduction.',
        path: ['compensatesEntryId'],
      });
    }
    if (BigInt(input.amount) > 0n && input.compensatesEntryId) {
      context.addIssue({
        code: 'custom',
        message: 'A grant cannot compensate an existing entry.',
        path: ['compensatesEntryId'],
      });
    }
  });
const reviewSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9._:-]{8,200}$/),
    reviewReason: z.string().trim().min(8).max(500),
    status: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict();

function amount(value: bigint): string {
  return value.toString();
}

function projection(value: CreditProjection) {
  return {
    free: {
      available: amount(value.free.available),
      consumed: amount(value.free.consumed),
      expired: amount(value.free.expired),
      reserved: amount(value.free.reserved),
    },
    purchased: {
      available: amount(value.purchased.available),
      consumed: amount(value.purchased.consumed),
      expired: amount(value.purchased.expired),
      reserved: amount(value.purchased.reserved),
    },
    totalAvailable: amount(value.totalAvailable),
    totalReserved: amount(value.totalReserved),
  };
}

function member(value: CreditMemberDetail) {
  return {
    accountStatus: value.accountStatus,
    displayName: value.displayName,
    email: value.email,
    history: value.history.map((entry) => ({
      ...entry,
      amount: amount(entry.amount),
      createdAt: entry.createdAt.toISOString(),
    })),
    pendingIncreaseRequest: value.pendingIncreaseRequest
      ? {
          ...value.pendingIncreaseRequest,
          createdAt: value.pendingIncreaseRequest.createdAt.toISOString(),
        }
      : null,
    projection: projection(value.projection),
    userId: value.userId,
  };
}

function page(value: CreditMemberPage) {
  return {
    ...value,
    items: value.items.map((item) => ({
      accountStatus: item.accountStatus,
      displayName: item.displayName,
      email: item.email,
      projection: projection(item.projection),
      userId: item.userId,
    })),
  };
}

function invalidInput(): ApiError {
  return new ApiError('INVALID_REQUEST', 'The request is invalid.', 400);
}

function serviceError(error: unknown): ApiError {
  const code = error instanceof Error ? error.message : '';
  if (code === 'IDEMPOTENCY_CONFLICT') {
    return new ApiError(code, 'The idempotency key is already in use.', 409);
  }
  if (
    code === 'CREDIT_MEMBER_NOT_FOUND' ||
    code === 'CREDIT_REQUEST_NOT_FOUND'
  ) {
    return new ApiError(
      'RESOURCE_NOT_FOUND',
      'The requested resource was not found.',
      404,
    );
  }
  if (code === 'CREDIT_REQUEST_STATE_CONFLICT') {
    return new ApiError(code, 'The request has already been reviewed.', 409);
  }
  if (code === 'PURCHASED_CREDITS_PROTECTED') {
    return new ApiError(code, 'Purchased credits cannot be adjusted.', 403);
  }
  return new ApiError(
    'CREDIT_OPERATION_FAILED',
    'The credit operation failed.',
    409,
  );
}

export function createCreditsApp(options: CreditsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const service = options.service ?? lazyCreditAdministrationService;
  const authentication = options.authentication ?? requireUser;

  app.onError((error, context) => {
    const apiError = error instanceof ApiError ? error : serviceError(error);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });
  app.use('/api/credits/*', authentication);
  app.use('/api/admin/credits/*', authentication);
  app.use('/api/admin/credits/*', requireCapability('credit.admin.manage'));

  app.get('/api/credits', async (context) => {
    const detail = await service.getOwnCredits(context.get('user').id);
    if (!detail)
      throw new ApiError('RESOURCE_NOT_FOUND', 'Credits were not found.', 404);
    return context.json({ credits: member(detail) });
  });

  app.post('/api/credits/increase-requests', async (context) => {
    const parsed = increaseRequestSchema.safeParse(await context.req.json());
    if (!parsed.success) throw invalidInput();
    const request = await service.createIncreaseRequest({
      ...parsed.data,
      userId: context.get('user').id,
    });
    return context.json(
      {
        request: {
          createdAt: request.createdAt.toISOString(),
          id: request.id,
          reason: request.reason,
          status: request.status,
        },
      },
      201,
    );
  });

  app.get('/api/admin/credits/members', async (context) => {
    const parsed = listSchema.safeParse(context.req.query());
    if (!parsed.success) throw invalidInput();
    return context.json({
      page: page(
        await service.listMembers({
          actorUserId: context.get('user').id,
          ...parsed.data,
        }),
      ),
    });
  });

  app.get('/api/admin/credits/members/:userId', async (context) => {
    const userId = z.uuid().safeParse(context.req.param('userId'));
    if (!userId.success) throw invalidInput();
    const detail = await service.getMember(context.get('user').id, userId.data);
    if (!detail)
      throw new ApiError('RESOURCE_NOT_FOUND', 'Member not found.', 404);
    return context.json({ member: member(detail) });
  });

  app.post(
    '/api/admin/credits/members/:userId/adjustments',
    async (context) => {
      const userId = z.uuid().safeParse(context.req.param('userId'));
      const parsed = adjustmentSchema.safeParse(await context.req.json());
      if (!userId.success || !parsed.success) throw invalidInput();
      const detail = await service.adjustFreeAllocation({
        actorUserId: context.get('user').id,
        amount: BigInt(parsed.data.amount),
        compensatesEntryId: parsed.data.compensatesEntryId,
        expiresAt: parsed.data.expiresAt
          ? new Date(parsed.data.expiresAt)
          : undefined,
        idempotencyKey: parsed.data.idempotencyKey,
        provenance: 'FREE_ALLOCATION',
        reason: parsed.data.reason,
        userId: userId.data,
      });
      return context.json({ member: member(detail) });
    },
  );

  app.get('/api/admin/credits/policies', async (context) => {
    void context;
    return context.json({ policies: await service.listPolicies() });
  });

  app.post(
    '/api/admin/credits/increase-requests/:requestId/review',
    async (context) => {
      const requestId = z.uuid().safeParse(context.req.param('requestId'));
      const parsed = reviewSchema.safeParse(await context.req.json());
      if (!requestId.success || !parsed.success) throw invalidInput();
      await service.reviewIncreaseRequest({
        actorUserId: context.get('user').id,
        requestId: requestId.data,
        ...parsed.data,
      });
      return context.json({ reviewed: true });
    },
  );

  return app;
}

export const creditsApp = createCreditsApp();
