import { handlePaymentWebhook } from './payment-webhook';
import { signStripePayload } from './stripe-webhook-signature';

const SECRET = 'whsec_test';
const NOW = new Date('2026-08-29T12:00:00.000Z');
const SECONDS = Math.floor(NOW.getTime() / 1_000);

function payloadFor(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    data: { object: { client_reference_id: 'ord_1' } },
    id: 'evt_1',
    type: 'checkout.session.completed',
    ...overrides,
  });
}

function build(
  options: {
    enabled?: boolean;
    order?: { id: string; status: string } | null;
    secret?: string | null;
    stored?: boolean;
  } = {},
) {
  const applied: Record<string, unknown>[] = [];
  const recorded: Record<string, unknown>[] = [];
  const ports = {
    applyTransition: vi.fn(async (input: Record<string, unknown>) => {
      applied.push(input);
    }),
    findOrder: vi.fn(async () =>
      options.order === undefined
        ? { id: 'order-1', status: 'PENDING' as const }
        : options.order,
    ),
    recordEvent: vi.fn(async (input: Record<string, unknown>) => {
      recorded.push(input);
      return options.stored ?? true;
    }),
  };
  return { applied, options, ports, recorded };
}

function run(
  harness: ReturnType<typeof build>,
  payload = payloadFor(),
  signingSecret = SECRET,
) {
  return handlePaymentWebhook({
    configuration: {
      enabled: harness.options.enabled ?? true,
      webhookSecret:
        harness.options.secret === undefined ? SECRET : harness.options.secret,
    },
    now: NOW,
    ports: harness.ports as never,
    rawPayload: payload,
    signatureHeader: `t=${SECONDS},v1=${signStripePayload({
      payload,
      secret: signingSecret,
      timestampSeconds: SECONDS,
    })}`,
  });
}

describe('réception d’un webhook de paiement', () => {
  it('attribue sur checkout.session.completed et honore dans le même geste', async () => {
    // The provider's last word on the money. No processor emits an event about
    // fulfilment, because none knows whether the learner received credits.
    const harness = build();
    await expect(run(harness)).resolves.toEqual({
      attributed: true,
      kind: 'APPLIED',
      providerEventId: 'evt_1',
      status: 'FULFILLED',
    });
  });

  it('n’attribue rien deux fois sur un événement rejeué', async () => {
    // The provider retries; the unique event id is what makes that harmless.
    const harness = build({ stored: false });
    await expect(run(harness)).resolves.toEqual({
      kind: 'DUPLICATE',
      providerEventId: 'evt_1',
    });
    expect(harness.applied).toEqual([]);
  });

  it('ne fait pas régresser une commande déjà honorée', async () => {
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });
    await expect(run(harness)).resolves.toEqual({
      kind: 'OUT_OF_ORDER',
      providerEventId: 'evt_1',
    });
    expect(harness.applied).toEqual([]);
  });

  it('conserve l’événement même quand il n’est pas appliqué', async () => {
    // Reconciliation reads what arrived, not only what we acted on.
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });
    await run(harness);
    expect(harness.recorded).toHaveLength(1);
  });

  it('refuse une charge utile falsifiée sans jamais la lire', async () => {
    const harness = build();
    await expect(run(harness, payloadFor(), 'whsec_wrong')).resolves.toEqual({
      kind: 'REJECTED',
      reason: 'SIGNATURE_MISMATCH',
    });
    // Nothing was looked up: an unverified webhook is not data.
    expect(harness.ports.findOrder).not.toHaveBeenCalled();
    expect(harness.recorded).toEqual([]);
  });

  it('ne traite rien quand l’encaissement est coupé', async () => {
    const harness = build({ enabled: false });
    await expect(run(harness)).resolves.toEqual({ kind: 'DISABLED' });
    expect(harness.ports.findOrder).not.toHaveBeenCalled();
  });

  it('ne traite rien sans secret configuré', async () => {
    // A default secret would accept anyone's forged delivery, which is worse
    // than accepting none.
    const harness = build({ secret: null });
    await expect(run(harness)).resolves.toEqual({ kind: 'DISABLED' });
  });

  it('enregistre un événement pour une commande inconnue sans l’appliquer', async () => {
    const harness = build({ order: null });
    await expect(run(harness)).resolves.toEqual({
      kind: 'UNKNOWN_ORDER',
      providerEventId: 'evt_1',
    });
    expect(harness.recorded[0]).toMatchObject({ orderId: null });
    expect(harness.applied).toEqual([]);
  });

  it('enregistre un événement inconnu sans l’appliquer', async () => {
    // Stripe's vocabulary will grow and must leave orders untouched rather
    // than corrupt them.
    const harness = build();
    await expect(
      run(harness, payloadFor({ id: 'evt_2', type: 'invoice.upcoming' })),
    ).resolves.toEqual({
      kind: 'OUT_OF_ORDER',
      // The id travels with the result so a log line can name the delivery.
      providerEventId: 'evt_2',
    });
    expect(harness.applied).toEqual([]);
  });

  it('refuse une enveloppe sans référence de commande', async () => {
    // Guessing here would attach an event to the wrong order.
    const harness = build();
    await expect(
      run(
        harness,
        JSON.stringify({ data: { object: {} }, id: 'e', type: 't' }),
      ),
    ).resolves.toEqual({ kind: 'REJECTED', reason: 'MALFORMED_PAYLOAD' });
  });

  it('refuse un corps illisible après signature valide', async () => {
    const harness = build();
    await expect(run(harness, 'pas du JSON')).resolves.toEqual({
      kind: 'REJECTED',
      reason: 'MALFORMED_PAYLOAD',
    });
  });
});

describe('résolution d’une commande à travers le cycle de vie (V4.5-195)', () => {
  /** A completed session: the id is the session, and it names its intent. */
  const sessionCompleted = JSON.stringify({
    data: {
      object: {
        client_reference_id: 'order-1',
        id: 'cs_test_1',
        payment_intent: 'pi_test_1',
      },
    },
    id: 'evt_session',
    type: 'checkout.session.completed',
  });

  /** A refund: a charge object. No session id, no client_reference_id. */
  const chargeRefunded = JSON.stringify({
    data: { object: { id: 'ch_test_1', payment_intent: 'pi_test_1' } },
    id: 'evt_refund',
    type: 'charge.refunded',
  });

  const disputeCreated = JSON.stringify({
    data: { object: { id: 'dp_test_1', payment_intent: 'pi_test_1' } },
    id: 'evt_dispute',
    type: 'charge.dispute.created',
  });

  it('enregistre l’identifiant de paiement dès que Stripe le nomme', async () => {
    const harness = build();

    await run(harness, sessionCompleted);

    // Without this, every later charge event arrives as an unknown order:
    // recorded, never applied, the order left FULFILLED while the money went
    // back.
    expect(harness.applied[0]).toMatchObject({
      paymentIntentId: 'pi_test_1',
      status: 'FULFILLED',
    });
  });

  it('cherche par identifiant de paiement d’abord, sur un remboursement', async () => {
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    await run(harness, chargeRefunded);

    // A charge carries neither the session id nor `client_reference_id`. If
    // the receiver looked those up it would find nothing.
    expect(harness.ports.findOrder).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test_1',
      reference: 'ch_test_1',
    });
  });

  it('résout un litige par le même identifiant', async () => {
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    await run(harness, disputeCreated);

    expect(harness.ports.findOrder).toHaveBeenCalledWith({
      paymentIntentId: 'pi_test_1',
      reference: 'dp_test_1',
    });
    expect(harness.applied[0]).toMatchObject({ status: 'DISPUTED' });
  });

  it('accepte une enveloppe qui n’a qu’un identifiant de paiement', async () => {
    // Some charge payloads carry no usable `id` for us; the intent alone must
    // be enough, or a refund would be refused as malformed.
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    const result = await run(
      harness,
      JSON.stringify({
        data: { object: { payment_intent: 'pi_test_1' } },
        id: 'evt_bare',
        type: 'charge.refunded',
      }),
    );

    expect(result).toMatchObject({ kind: 'APPLIED' });
  });

  it('refuse une enveloppe sans aucun des deux', async () => {
    const harness = build();

    const result = await run(
      harness,
      JSON.stringify({
        data: { object: {} },
        id: 'evt_empty',
        type: 'charge.refunded',
      }),
    );

    // Guessing here would attach a refund to the wrong order.
    expect(result).toMatchObject({ kind: 'REJECTED' });
    expect(harness.recorded).toEqual([]);
  });
});
