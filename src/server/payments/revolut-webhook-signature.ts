import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook signature verification (ADR_004 §5).
 *
 * Verified before the payload is parsed, never after. An unverified webhook is
 * not data: reading it first — even to find an order id for a log line — makes
 * whatever we read attacker-controlled.
 */

type SignatureFailure =
  | 'MISSING_HEADER'
  | 'MALFORMED_HEADER'
  | 'SIGNATURE_MISMATCH'
  | 'TIMESTAMP_OUT_OF_WINDOW';

export type SignatureVerdict =
  { valid: true } | { valid: false; reason: SignatureFailure };

/**
 * How far a delivery may be from our clock. Wide enough for a retry and a
 * clock that drifts, narrow enough that a captured request stops being
 * replayable the same day.
 */
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1_000;

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // Compared on equal-length buffers only: timingSafeEqual throws otherwise,
  // and the length itself is not a secret.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signRevolutPayload(input: {
  payload: string;
  secret: string;
  timestamp: number;
}): string {
  return createHmac('sha256', input.secret)
    .update(`v1.${input.timestamp}.${input.payload}`)
    .digest('hex');
}

/**
 * `rawPayload` must be the bytes as received. Re-serialising parsed JSON
 * changes key order and whitespace, and the signature would then never match
 * anything the provider signed.
 */
export function verifyRevolutSignature(input: {
  now: Date;
  rawPayload: string;
  secret: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  toleranceMs?: number;
}): SignatureVerdict {
  if (!input.signatureHeader || !input.timestampHeader) {
    return { reason: 'MISSING_HEADER', valid: false };
  }

  const timestamp = Number(input.timestampHeader);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return { reason: 'MALFORMED_HEADER', valid: false };
  }

  const tolerance = input.toleranceMs ?? SIGNATURE_TOLERANCE_MS;
  if (Math.abs(input.now.getTime() - timestamp) > tolerance) {
    // Checked before the HMAC so an old capture is refused on its age rather
    // than on a comparison it might still win.
    return { reason: 'TIMESTAMP_OUT_OF_WINDOW', valid: false };
  }

  const expected = signRevolutPayload({
    payload: input.rawPayload,
    secret: input.secret,
    timestamp,
  });
  const provided = input.signatureHeader.startsWith('v1=')
    ? input.signatureHeader.slice(3)
    : input.signatureHeader;

  return constantTimeEquals(expected, provided)
    ? { valid: true }
    : { reason: 'SIGNATURE_MISMATCH', valid: false };
}
