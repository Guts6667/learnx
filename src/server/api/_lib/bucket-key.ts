import { createHmac } from 'node:crypto';

/**
 * Keys for rate-limit and anti-abuse buckets (V4.5-147).
 *
 * These buckets are keyed on an IP address or an e-mail. A plain SHA-256 of an
 * IPv4 address is not a protection: the space is 2^32 and the prefix is a
 * constant in this repository, so a table recovers the address in seconds. The
 * digest was a rearrangement of the address, not a shield, and the privacy
 * policy could not honestly say the address was not retained.
 *
 * An HMAC under a server-held secret does shield it: without the key the digest
 * identifies nobody, and with it we can still recognise a repeat visitor, which
 * is all a bucket needs.
 *
 * Rotating the secret invalidates every bucket, which is harmless — windows are
 * hours long and the rows are purged on their window.
 */

const DEVELOPMENT_SECRET = 'learnx-development-bucket-secret';

/**
 * Missing in production is refused rather than defaulted. A default secret in
 * production would be a published key, which is the same as no key at all while
 * looking like protection — the failure mode this ticket exists to remove.
 */
export function readBucketHmacSecret(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const secret = environment.LEARNX_BUCKET_HMAC_SECRET?.trim();
  if (secret) return secret;
  if (
    environment.NODE_ENV === 'production' ||
    environment.LEARNX_AI_CONFIG_ENVIRONMENT === 'production'
  ) {
    throw new Error('LEARNX_BUCKET_HMAC_SECRET is required in production.');
  }
  // Deterministic outside production so tests and local runs behave, and
  // published on purpose: it protects nothing and is not meant to.
  return DEVELOPMENT_SECRET;
}

export function hashBucketKey(
  value: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return createHmac('sha256', readBucketHmacSecret(environment))
    .update(value)
    .digest('hex');
}
