import {
  SIGNATURE_TOLERANCE_MS,
  signRevolutPayload,
  verifyRevolutSignature,
} from './revolut-webhook-signature';

const SECRET = 'wsk_sandbox_secret';
const NOW = new Date('2026-08-29T12:00:00.000Z');
const PAYLOAD = JSON.stringify({ event: 'ORDER_COMPLETED', order_id: 'ord_1' });

function sign(payload = PAYLOAD, at = NOW) {
  return signRevolutPayload({
    payload,
    secret: SECRET,
    timestamp: at.getTime(),
  });
}

function verify(overrides: Record<string, unknown> = {}) {
  return verifyRevolutSignature({
    now: NOW,
    rawPayload: PAYLOAD,
    secret: SECRET,
    signatureHeader: `v1=${sign()}`,
    timestampHeader: String(NOW.getTime()),
    ...overrides,
  });
}

describe('verifyRevolutSignature', () => {
  it('accepte une signature valide', () => {
    expect(verify()).toEqual({ valid: true });
  });

  it('refuse une charge utile modifiée', () => {
    // The signature covers the bytes; changing a single field breaks it.
    expect(
      verify({
        rawPayload: JSON.stringify({
          event: 'ORDER_COMPLETED',
          order_id: 'ord_2',
        }),
      }),
    ).toEqual({ reason: 'SIGNATURE_MISMATCH', valid: false });
  });

  it('refuse une signature valide pour un autre secret', () => {
    expect(
      verify({
        signatureHeader: `v1=${signRevolutPayload({
          payload: PAYLOAD,
          secret: 'another-secret',
          timestamp: NOW.getTime(),
        })}`,
      }),
    ).toEqual({ reason: 'SIGNATURE_MISMATCH', valid: false });
  });

  it('refuse un rejeu hors fenêtre', () => {
    // A captured request stops being replayable once it ages out, even though
    // its signature stays mathematically correct forever.
    const old = new Date(NOW.getTime() - SIGNATURE_TOLERANCE_MS - 1_000);
    expect(
      verify({
        signatureHeader: `v1=${sign(PAYLOAD, old)}`,
        timestampHeader: String(old.getTime()),
      }),
    ).toEqual({ reason: 'TIMESTAMP_OUT_OF_WINDOW', valid: false });
  });

  it('accepte un rejeu dans la fenêtre, que l’idempotence rattrape ensuite', () => {
    // The window is not the replay defence — the unique event id is. This one
    // only bounds how long a capture is worth anything.
    const recent = new Date(NOW.getTime() - 60_000);
    expect(
      verify({
        signatureHeader: `v1=${sign(PAYLOAD, recent)}`,
        timestampHeader: String(recent.getTime()),
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    ['signature absente', { signatureHeader: null }],
    ['horodatage absent', { timestampHeader: null }],
  ])('refuse une requête sans %s', (_label, overrides) => {
    expect(verify(overrides)).toEqual({
      reason: 'MISSING_HEADER',
      valid: false,
    });
  });

  it.each([['pas-un-nombre'], ['-1'], ['1e400']])(
    'refuse un horodatage illisible (%s)',
    (timestampHeader) => {
      expect(verify({ timestampHeader })).toEqual({
        reason: 'MALFORMED_HEADER',
        valid: false,
      });
    },
  );

  it('accepte la signature nue comme la signature préfixée', () => {
    expect(verify({ signatureHeader: sign() })).toEqual({ valid: true });
  });
});

describe('comparaison en temps constant', () => {
  it('utilise timingSafeEqual et jamais une égalité de chaînes', async () => {
    // A unit test cannot observe a timing difference reliably — asserting it
    // by measurement would be a flaky test that proves nothing. This asserts
    // the mechanism instead, and says so: it is structural, not behavioural.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      'src/server/payments/revolut-webhook-signature.ts',
      'utf8',
    );
    // The import alone is not the mechanism — the call is. Asserting the
    // import would have passed with the comparison replaced, which is exactly
    // what a first version of this test did.
    expect(source).toContain('return timingSafeEqual(');
  });
});
