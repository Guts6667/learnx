import {
  STRIPE_TOLERANCE_MS,
  signStripePayload,
  verifyStripeSignature,
} from './stripe-webhook-signature';

const SECRET = 'whsec_test';
const NOW = new Date('2026-08-29T12:00:00.000Z');
const SECONDS = Math.floor(NOW.getTime() / 1_000);
const PAYLOAD = JSON.stringify({
  id: 'evt_1',
  type: 'checkout.session.completed',
});

function header(overrides: { seconds?: number; signatures?: string[] } = {}) {
  const seconds = overrides.seconds ?? SECONDS;
  const signatures = overrides.signatures ?? [
    signStripePayload({
      payload: PAYLOAD,
      secret: SECRET,
      timestampSeconds: seconds,
    }),
  ];
  return [`t=${seconds}`, ...signatures.map((value) => `v1=${value}`)].join(
    ',',
  );
}

function verify(overrides: Record<string, unknown> = {}) {
  return verifyStripeSignature({
    now: NOW,
    rawPayload: PAYLOAD,
    secret: SECRET,
    signatureHeader: header(),
    ...overrides,
  });
}

describe('verifyStripeSignature', () => {
  it('accepte une signature valide', () => {
    expect(verify()).toEqual({ valid: true });
  });

  it('accepte quand une seule des signatures correspond', () => {
    // During a secret rotation Stripe signs with both the old and the new
    // secret. A verifier reading only the first would start rejecting live
    // deliveries on rotation day.
    expect(
      verify({
        signatureHeader: header({
          signatures: [
            signStripePayload({
              payload: PAYLOAD,
              secret: 'whsec_previous',
              timestampSeconds: SECONDS,
            }),
            signStripePayload({
              payload: PAYLOAD,
              secret: SECRET,
              timestampSeconds: SECONDS,
            }),
          ],
        }),
      }),
    ).toEqual({ valid: true });
  });

  it('refuse une charge utile modifiée', () => {
    expect(
      verify({ rawPayload: JSON.stringify({ id: 'evt_2', type: 'x' }) }),
    ).toEqual({ reason: 'SIGNATURE_MISMATCH', valid: false });
  });

  it('refuse une signature d’un autre secret', () => {
    expect(
      verify({
        signatureHeader: header({
          signatures: [
            signStripePayload({
              payload: PAYLOAD,
              secret: 'whsec_other',
              timestampSeconds: SECONDS,
            }),
          ],
        }),
      }),
    ).toEqual({ reason: 'SIGNATURE_MISMATCH', valid: false });
  });

  it('refuse une livraison hors fenêtre', () => {
    const old = SECONDS - STRIPE_TOLERANCE_MS / 1_000 - 60;
    expect(verify({ signatureHeader: header({ seconds: old }) })).toEqual({
      reason: 'TIMESTAMP_OUT_OF_WINDOW',
      valid: false,
    });
  });

  it('accepte un rejeu dans la fenêtre, que l’identifiant d’événement rattrape', () => {
    // The window is not the replay defence — the unique event id is. It only
    // bounds how long a capture is worth attempting.
    const recent = SECONDS - 60;
    expect(verify({ signatureHeader: header({ seconds: recent }) })).toEqual({
      valid: true,
    });
  });

  it.each([
    ['en-tête absent', null],
    ['horodatage manquant', 'v1=abc'],
    ['aucune signature', `t=${SECONDS}`],
    ['horodatage illisible', `t=pas-un-nombre,v1=abc`],
  ])('refuse %s', (_label, signatureHeader) => {
    const verdict = verify({ signatureHeader });
    expect(verdict.valid).toBe(false);
  });

  it('utilise une comparaison en temps constant', async () => {
    // Asserted on the mechanism: measuring a timing difference would be a
    // flaky test that proves nothing.
    const { readFileSync } = await import('node:fs');
    expect(
      readFileSync('src/server/payments/stripe-webhook-signature.ts', 'utf8'),
    ).toContain('return timingSafeEqual(');
  });
});
