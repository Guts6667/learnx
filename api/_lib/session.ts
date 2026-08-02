import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'learnx_session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function getSessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
