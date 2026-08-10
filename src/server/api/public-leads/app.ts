import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { getClientAddress } from '../_lib/client-address.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  SharedAccessRequestRateLimiter,
  type AccessRequestRateLimiter,
} from '../_lib/access-request-rate-limit.js';
import {
  createPublicLeadServiceDependencies,
  hashPublicLeadToken,
  prismaPublicLeadRepository,
  requestPublicLead,
  type PublicLeadRepository,
  type PublicLeadServiceDependencies,
} from './service.js';

interface PublicLeadsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  dependencies?: PublicLeadServiceDependencies;
  rateLimiter?: AccessRequestRateLimiter;
  repository?: PublicLeadRepository;
}

const requestSchema = z
  .object({
    consent: z.literal(true),
    email: z.email().trim().toLowerCase().max(320),
    locale: z.enum(['fr', 'en']),
    motivation: z.string().trim().min(20).max(2_000).optional(),
    purpose: z.enum(['LAUNCH_UPDATES', 'EARLY_ADOPTER']),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.purpose === 'EARLY_ADOPTER' && !input.motivation) {
      context.addIssue({
        code: 'custom',
        message: 'Motivation is required.',
        path: ['motivation'],
      });
    }
    if (input.purpose === 'LAUNCH_UPDATES' && input.motivation) {
      context.addIssue({
        code: 'custom',
        message: 'Motivation is not accepted.',
        path: ['motivation'],
      });
    }
  });
const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
const exportSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1_000).default(250),
  purpose: z.enum(['LAUNCH_UPDATES', 'EARLY_ADOPTER']).optional(),
  status: z
    .enum(['PENDING_CONFIRMATION', 'CONFIRMED', 'UNSUBSCRIBED', 'DELETED'])
    .optional(),
});
const identifierSchema = z.uuid();
const limiter = new SharedAccessRequestRateLimiter();

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(
      'INVALID_REQUEST',
      'Request body must be valid JSON.',
      400,
    );
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function createPublicLeadsApp(options: PublicLeadsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const repository = options.repository ?? prismaPublicLeadRepository;
  const dependencies =
    options.dependencies ?? createPublicLeadServiceDependencies();
  const rateLimiter = options.rateLimiter ?? limiter;

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.post('/api/public-leads', async (context) => {
    if (!dependencies)
      throw new ApiError(
        'PUBLIC_LEADS_UNAVAILABLE',
        'Public interest forms are unavailable.',
        503,
      );
    const parsed = requestSchema.safeParse(await parseJson(context.req.raw));
    if (!parsed.success)
      throw new ApiError(
        'INVALID_REQUEST',
        'Invalid public interest request.',
        400,
      );
    await rateLimiter.consume(
      {
        clientAddress: getClientAddress(context.req.raw),
        email: parsed.data.email,
      },
      dependencies.now(),
    );
    await requestPublicLead(parsed.data, dependencies);
    return context.json(
      { message: 'Check your email to confirm your request.' },
      202,
    );
  });

  app.post('/api/public-leads/confirm', async (context) => {
    const parsed = tokenSchema.safeParse(await parseJson(context.req.raw));
    if (
      !parsed.success ||
      !(await repository.confirm(
        hashPublicLeadToken(parsed.data.token),
        new Date(),
      ))
    ) {
      throw new ApiError(
        'INVALID_PUBLIC_LEAD_TOKEN',
        'This link is invalid or expired.',
        400,
      );
    }
    return context.json({ status: 'confirmed' as const });
  });

  app.post('/api/public-leads/unsubscribe', async (context) => {
    const parsed = tokenSchema.safeParse(await parseJson(context.req.raw));
    if (
      !parsed.success ||
      !(await repository.unsubscribe(
        hashPublicLeadToken(parsed.data.token),
        new Date(),
      ))
    ) {
      throw new ApiError(
        'INVALID_PUBLIC_LEAD_TOKEN',
        'This link is invalid or expired.',
        400,
      );
    }
    return context.json({ status: 'unsubscribed' as const });
  });

  app.post('/api/public-leads/delete', async (context) => {
    const parsed = tokenSchema.safeParse(await parseJson(context.req.raw));
    if (
      !parsed.success ||
      !(await repository.delete(
        hashPublicLeadToken(parsed.data.token),
        new Date(),
      ))
    ) {
      throw new ApiError(
        'INVALID_PUBLIC_LEAD_TOKEN',
        'This link is invalid or expired.',
        400,
      );
    }
    return context.json({ status: 'deleted' as const });
  });

  app.use('/api/admin/public-leads/*', options.authentication ?? requireUser);
  app.get('/api/admin/public-leads/export', async (context) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const parsed = exportSchema.safeParse(context.req.query());
    if (!parsed.success)
      throw new ApiError('INVALID_REQUEST', 'Invalid export request.', 400);
    const rows = await repository.export(parsed.data);
    const header = [
      'id',
      'email',
      'purpose',
      'status',
      'locale',
      'motivation',
      'created_at',
      'confirmed_at',
    ];
    const csv = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.id,
          row.emailNormalized,
          row.purpose,
          row.status,
          row.locale,
          row.motivation ?? '',
          row.createdAt.toISOString(),
          row.confirmedAt?.toISOString() ?? '',
        ]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
    context.header(
      'Content-Disposition',
      'attachment; filename="learnx-public-leads.csv"',
    );
    context.header('Content-Type', 'text/csv; charset=utf-8');
    return context.body(csv);
  });

  app.post(
    '/api/admin/public-leads/:leadId/convert-to-access-request',
    async (context) => {
      assertCapability(context.get('user').role, 'account.request.review');
      const parsed = identifierSchema.safeParse(context.req.param('leadId'));
      if (!parsed.success) {
        throw new ApiError('INVALID_REQUEST', 'Invalid lead identifier.', 400);
      }
      const requestId = await repository.convertToAccessRequest(
        parsed.data,
        new Date(),
      );
      if (!requestId) {
        throw new ApiError(
          'RESOURCE_NOT_FOUND',
          'Confirmed public lead not found.',
          404,
        );
      }
      return context.json({
        nextAction: 'REVIEW_AND_INVITE' as const,
        requestId,
      });
    },
  );

  return app;
}

export const publicLeadsApp = createPublicLeadsApp();
