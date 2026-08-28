import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';

const querySchema = z.object({
  timeZone: z.string().trim().min(1).max(100).default('UTC'),
});

export function parseTodayTimeZone(url: string): string {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(url).searchParams),
  );

  if (!parsed.success) {
    throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
  }

  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: parsed.data.timeZone });
  } catch {
    throw new ApiError('INVALID_REQUEST', 'Invalid time zone.', 400);
  }

  return parsed.data.timeZone;
}
