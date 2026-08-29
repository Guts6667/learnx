import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stripe webhook signature verification (V4.5-184).
 *
 * Stripe signs `${timestamp}.${payload}` with HMAC-SHA256 and sends the result
 * in `Stripe-Signature` as `t=<unix seconds>,v1=<hex>`. The header may carry
 * **several** `v1` values: during a secret rotation Stripe signs with both the
 * old and the new one, so a verifier that reads only the first would start
 * rejecting live deliveries the moment a secret is rotated. Every `v1` is
 * checked and any match accepts.
 *
 * The timestamp window is a secondary defence. What makes a replay harmless is
 * the uniqueness of the event id, not the age of the request — the window only
 * bounds how long a captured delivery is worth attempting.
 */

type StripeSignatureFailure =
  | 'MISSING_HEADER'
  | 'MALFORMED_HEADER'
  | 'SIGNATURE_MISMATCH'
  | 'TIMESTAMP_OUT_OF_WINDOW';

export type StripeSignatureVerdict =
  { valid: true } | { valid: false; reason: StripeSignatureFailure };

export const STRIPE_TOLERANCE_MS = 5 * 60 * 1_000;

interface ParsedHeader {
  signatures: string[];
  timestampSeconds: number;
}

function parseHeader(header: string): ParsedHeader | null {
  const signatures: string[] = [];
  let timestampSeconds: number | null = null;
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (!key || !value) continue;
    if (key === 't') timestampSeconds = Number(value);
    if (key === 'v1') signatures.push(value);
  }
  if (
    timestampSeconds === null ||
    !Number.isSafeInteger(timestampSeconds) ||
    timestampSeconds <= 0 ||
    signatures.length === 0
  ) {
    return null;
  }
  return { signatures, timestampSeconds };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signStripePayload(input: {
  payload: string;
  secret: string;
  timestampSeconds: number;
}): string {
  return createHmac('sha256', input.secret)
    .update(`${input.timestampSeconds}.${input.payload}`)
    .digest('hex');
}

/**
 * `rawPayload` must be the bytes as received. Re-serialising parsed JSON
 * changes key order and whitespace, and no signature would ever match.
 */
export function verifyStripeSignature(input: {
  now: Date;
  rawPayload: string;
  secret: string;
  signatureHeader: string | null;
  toleranceMs?: number;
}): StripeSignatureVerdict {
  if (!input.signatureHeader) return { reason: 'MISSING_HEADER', valid: false };
  const parsed = parseHeader(input.signatureHeader);
  if (!parsed) return { reason: 'MALFORMED_HEADER', valid: false };

  const tolerance = input.toleranceMs ?? STRIPE_TOLERANCE_MS;
  const ageMs = Math.abs(input.now.getTime() - parsed.timestampSeconds * 1_000);
  if (ageMs > tolerance) {
    return { reason: 'TIMESTAMP_OUT_OF_WINDOW', valid: false };
  }

  const expected = signStripePayload({
    payload: input.rawPayload,
    secret: input.secret,
    timestampSeconds: parsed.timestampSeconds,
  });
  // Any match accepts: during a rotation Stripe signs with both secrets, and
  // reading only the first would reject live deliveries on rotation day.
  const matched = parsed.signatures.some((candidate) =>
    constantTimeEquals(expected, candidate),
  );
  return matched
    ? { valid: true }
    : { reason: 'SIGNATURE_MISMATCH', valid: false };
}
