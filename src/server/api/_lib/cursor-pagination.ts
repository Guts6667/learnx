import { z } from 'zod';

const cursorSchema = z.object({
  context: z.string(),
  id: z.string().uuid(),
  scope: z.string(),
  value: z.string(),
  version: z.literal(1),
});

export const cursorPageQuerySchema = z.object({
  cursor: z.string().min(1).max(1_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export interface CursorPosition {
  id: string;
  value: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid pagination cursor.');
  }
}

export function encodeCursor(
  scope: string,
  context: string,
  position: CursorPosition,
): string {
  return Buffer.from(
    JSON.stringify({ ...position, context, scope, version: 1 }),
  ).toString('base64url');
}

export function parseCursor(
  rawCursor: string | undefined,
  scope: string,
  context: string,
): CursorPosition | undefined {
  if (!rawCursor) return undefined;

  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')),
    );
    if (
      !parsed.success ||
      parsed.data.scope !== scope ||
      parsed.data.context !== context
    ) {
      throw new InvalidCursorError();
    }
    return { id: parsed.data.id, value: parsed.data.value };
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error;
    throw new InvalidCursorError();
  }
}

export function toCursorPage<T>(
  records: T[],
  pageSize: number,
  getCursor: (record: T) => string,
): CursorPage<T> {
  const items = records.slice(0, pageSize);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      records.length > pageSize && lastItem ? getCursor(lastItem) : null,
  };
}
