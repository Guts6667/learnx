import { createHash } from 'node:crypto';

export function hashPublicLeadToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildPublicLeadActionUrl(
  appUrl: string,
  action: string,
  token: string,
): string {
  const url = new URL('/interest', appUrl);
  url.hash = new URLSearchParams({ action, token }).toString();
  return url.toString();
}
