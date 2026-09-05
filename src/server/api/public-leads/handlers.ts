import type { Context } from 'hono';
import { z } from 'zod';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { getClientAddress } from '../_lib/client-address.js';
import { ApiError } from '../_lib/errors.js';
import type { AccessRequestRateLimiter } from '../_lib/access-request-rate-limit.js';
import { hashPublicLeadToken } from './token-service.js';
import { requestPublicLead } from './service.js';
import type {
  PublicLeadRepository,
  PublicLeadServiceDependencies,
} from './types.js';

/**
 * Le corps d'une candidature ou d'un abonnement (V4.5-228).
 *
 * Une seule requête porte la soumission entière du formulaire de la landing :
 * la candidature EARLY_ADOPTER et, si la case est cochée, l'abonnement
 * LAUNCH_UPDATES. Deux appels laisseraient l'apprenant candidat sans être
 * abonné — ou l'inverse — quand le second échoue, et lui enverraient deux
 * courriels de confirmation pour un seul geste.
 *
 * `friction` suit la règle de minimisation déjà appliquée à `motivation` :
 * c'est une question de candidature, elle n'est pas acceptée sur un simple
 * abonnement. `firstName` échappe à cette règle — il sert à saluer la
 * personne dans le courriel, quel que soit le motif — mais il n'est exigé que
 * pour une candidature.
 */
const requestSchema = z
  .object({
    consent: z.literal(true),
    email: z.email().trim().toLowerCase().max(320),
    firstName: z.string().trim().min(1).max(80).optional(),
    friction: z.string().trim().min(1).max(2_000).optional(),
    /** Coche « launch updates » : abonne EN PLUS de la candidature. */
    launchUpdates: z.boolean().optional(),
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
    if (input.purpose === 'EARLY_ADOPTER' && !input.firstName) {
      context.addIssue({
        code: 'custom',
        message: 'First name is required.',
        path: ['firstName'],
      });
    }
    if (input.purpose === 'LAUNCH_UPDATES' && input.motivation) {
      context.addIssue({
        code: 'custom',
        message: 'Motivation is not accepted.',
        path: ['motivation'],
      });
    }
    if (input.purpose === 'LAUNCH_UPDATES' && input.friction) {
      context.addIssue({
        code: 'custom',
        message: 'Friction is not accepted.',
        path: ['friction'],
      });
    }
    // S'abonner en plus d'un abonnement ne veut rien dire, et l'accepter en
    // silence laisserait croire qu'un second enregistrement a eu lieu.
    if (input.purpose === 'LAUNCH_UPDATES' && input.launchUpdates) {
      context.addIssue({
        code: 'custom',
        message: 'Launch updates is not accepted for this purpose.',
        path: ['launchUpdates'],
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
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  purpose: z.enum(['LAUNCH_UPDATES', 'EARLY_ADOPTER']).optional(),
  search: z.string().trim().max(320).optional(),
});
const identifierSchema = z.uuid();

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

export function createPublicLeadRequestHandler(
  dependencies: PublicLeadServiceDependencies | undefined,
  rateLimiter: AccessRequestRateLimiter,
) {
  return async (context: Context<AuthEnvironment>) => {
    if (!dependencies) {
      throw new ApiError(
        'PUBLIC_LEADS_UNAVAILABLE',
        'Public interest forms are unavailable.',
        503,
      );
    }
    const parsed = requestSchema.safeParse(await parseJson(context.req.raw));
    if (!parsed.success) {
      throw new ApiError(
        'INVALID_REQUEST',
        'Invalid public interest request.',
        400,
      );
    }
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
  };
}

type TokenAction = 'confirm' | 'delete' | 'unsubscribe';

export function createPublicLeadTokenHandler(
  action: TokenAction,
  repository: PublicLeadRepository,
) {
  return async (context: Context<AuthEnvironment>) => {
    const parsed = tokenSchema.safeParse(await parseJson(context.req.raw));
    if (
      !parsed.success ||
      !(await repository[action](
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
    const status =
      action === 'confirm'
        ? ('confirmed' as const)
        : action === 'delete'
          ? ('deleted' as const)
          : ('unsubscribed' as const);
    return context.json({ status });
  };
}

export function createPublicLeadListHandler(repository: PublicLeadRepository) {
  return async (context: Context<AuthEnvironment>) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const parsed = listSchema.safeParse(context.req.query());
    if (!parsed.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid contact query.', 400);
    }
    return context.json({ page: await repository.list(parsed.data) });
  };
}

function serializeExport(
  repositoryRows: Awaited<ReturnType<PublicLeadRepository['export']>>,
) {
  // `first_name` et `friction` suivent `email` et `motivation` : l'export sert
  // à lire des candidatures, et une colonne ajoutée en fin de ligne se lirait
  // moins bien qu'à côté de ce qu'elle complète (V4.5-228).
  const header = [
    'id',
    'email',
    'first_name',
    'purpose',
    'status',
    'locale',
    'motivation',
    'friction',
    'created_at',
    'confirmed_at',
  ];
  return [
    header.join(','),
    ...repositoryRows.map((row) =>
      [
        row.id,
        row.emailNormalized,
        row.firstName ?? '',
        row.purpose,
        row.status,
        row.locale,
        row.motivation ?? '',
        row.friction ?? '',
        row.createdAt.toISOString(),
        row.confirmedAt?.toISOString() ?? '',
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');
}

export function createPublicLeadExportHandler(
  repository: PublicLeadRepository,
) {
  return async (context: Context<AuthEnvironment>) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const parsed = exportSchema.safeParse(context.req.query());
    if (!parsed.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid export request.', 400);
    }
    const csv = serializeExport(await repository.export(parsed.data));
    context.header(
      'Content-Disposition',
      'attachment; filename="learnx-public-leads.csv"',
    );
    context.header('Content-Type', 'text/csv; charset=utf-8');
    return context.body(csv);
  };
}

export function createPublicLeadConversionHandler(
  repository: PublicLeadRepository,
) {
  return async (context: Context<AuthEnvironment>) => {
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
  };
}
