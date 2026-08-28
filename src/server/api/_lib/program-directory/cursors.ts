import { z } from 'zod';

import { ProgramEnrollmentStatus } from '../../../../../generated/prisma/client.js';
import type { SupportedLocale } from '../../../../shared/locale.js';

const catalogCursorSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  locale: z.enum(['fr', 'en']),
  scope: z.literal('catalog'),
  search: z.string().nullable(),
  version: z.literal(1),
});

const enrolledCursorSchema = z.object({
  id: z.string().uuid(),
  scope: z.literal('enrolled'),
  search: z.string().nullable(),
  status: z.nativeEnum(ProgramEnrollmentStatus),
  updatedAt: z.string().datetime(),
  version: z.literal(1),
});

export class InvalidProgramDirectoryCursorError extends Error {
  public constructor() {
    super('Invalid program directory cursor.');
    this.name = 'InvalidProgramDirectoryCursorError';
  }
}

export function normalizeProgramSearch(search: string | undefined) {
  const normalized = search?.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidProgramDirectoryCursorError();
  }
}

export function parseCatalogCursor(
  cursor: string | undefined,
  search: string | undefined,
  locale: SupportedLocale,
) {
  if (!cursor) return undefined;
  const parsed = catalogCursorSchema.safeParse(decodeCursor(cursor));
  if (
    !parsed.success ||
    parsed.data.search !== (search ?? null) ||
    parsed.data.locale !== locale
  ) {
    throw new InvalidProgramDirectoryCursorError();
  }
  return parsed.data;
}

export function parseEnrolledCursor(
  cursor: string | undefined,
  search: string | undefined,
  status: ProgramEnrollmentStatus,
) {
  if (!cursor) return undefined;
  const parsed = enrolledCursorSchema.safeParse(decodeCursor(cursor));
  if (
    !parsed.success ||
    parsed.data.search !== (search ?? null) ||
    parsed.data.status !== status
  ) {
    throw new InvalidProgramDirectoryCursorError();
  }
  return parsed.data;
}

export function createCatalogCursor(input: {
  hasNextPage: boolean;
  id?: string;
  locale: SupportedLocale;
  position?: number;
  search?: string;
}) {
  if (!input.hasNextPage || !input.id || input.position === undefined) {
    return null;
  }
  return encodeCursor({
    id: input.id,
    locale: input.locale,
    position: input.position,
    scope: 'catalog',
    search: input.search ?? null,
    version: 1,
  });
}

export function createEnrolledCursor(input: {
  hasNextPage: boolean;
  id?: string;
  search?: string;
  status: ProgramEnrollmentStatus;
  updatedAt?: Date;
}) {
  if (!input.hasNextPage || !input.id || !input.updatedAt) return null;
  return encodeCursor({
    id: input.id,
    scope: 'enrolled',
    search: input.search ?? null,
    status: input.status,
    updatedAt: input.updatedAt.toISOString(),
    version: 1,
  });
}
