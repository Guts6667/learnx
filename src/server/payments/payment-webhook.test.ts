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
    /** Ce que le remboursement, désormais dans la transaction, a répondu. */
    compensated?: boolean;
    enabled?: boolean;
    order?: { id: string; status: string } | null;
    secret?: string | null;
    stored?: boolean;
  } = {},
) {
  const applied: Record<string, unknown>[] = [];
  const compensated: string[] = [];
  const recorded: Record<string, unknown>[] = [];
  const ports = {
    findOrder: vi.fn(async () =>
      options.order === undefined
        ? { id: 'order-1', status: 'PENDING' as const }
        : options.order,
    ),
    recordDelivery: vi.fn(
      async (
        input: Record<string, unknown> & {
          compensateRefundForOrderId?: string;
          transition?: unknown;
        },
      ) => {
        recorded.push(input);
        const stored = options.stored ?? true;
        // One call now carries all three (V4.5-199, puis V4.5-211 pour le
        // remboursement) ; le harnais les sépare encore pour que les
        // assertions disent ce qu'elles voulaient dire. Un insert refusé
        // n'applique rien — la transaction est annulée, et modéliser
        // autrement laisserait passer une double attribution.
        if (stored && input.transition) applied.push(input.transition as never);
        if (stored && input.compensateRefundForOrderId) {
          compensated.push(input.compensateRefundForOrderId);
        }
        return {
          stored,
          ...(input.compensateRefundForOrderId
            ? { compensated: options.compensated ?? true }
            : {}),
        };
      },
    ),
  };
  return { applied, compensated, options, ports, recorded };
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
      kind: 'UNKNOWN_EVENT',
      // The id travels with the result so a log line can name the delivery.
      providerEventId: 'evt_2',
    });
    expect(harness.applied).toEqual([]);
  });

  describe('ce qui est consigné, et non ce qu’on espérait consigner', () => {
    // Until V4.5-198 the outcome was computed before the transition was
    // decided, and no test read it — the assertions above check that nothing
    // is *applied*, which stayed true while the record said it had been.

    it('consigne OUT_OF_ORDER pour un PAID tardif, et non APPLIED', async () => {
      // The case the ordering-tolerant design exists to absorb. Recorded as
      // APPLIED, it was an audit trail asserting an attribution that never
      // happened — and reconciliation reads that trail.
      const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });
      await run(harness);
      expect(harness.recorded[0]).toMatchObject({ outcome: 'OUT_OF_ORDER' });
      expect(harness.applied).toEqual([]);
    });

    it('consigne UNKNOWN_EVENT pour un nom absent de la table', async () => {
      // The one failure this receiver cannot detect for itself: money taken,
      // order never fulfilled, nothing failing loudly. Spelled OUT_OF_ORDER it
      // was indistinguishable from the benign case above.
      const harness = build();
      await run(harness, payloadFor({ id: 'evt_2', type: 'invoice.upcoming' }));
      expect(harness.recorded[0]).toMatchObject({
        eventType: 'invoice.upcoming',
        outcome: 'UNKNOWN_EVENT',
      });
      expect(harness.applied).toEqual([]);
    });

    it('consigne UNKNOWN_ORDER quand aucune commande ne correspond', async () => {
      const harness = build({ order: null });
      await run(harness);
      expect(harness.recorded[0]).toMatchObject({
        orderId: null,
        outcome: 'UNKNOWN_ORDER',
      });
    });

    it('consigne APPLIED quand la transition est bien acceptée', async () => {
      const harness = build();
      await run(harness);
      expect(harness.recorded[0]).toMatchObject({ outcome: 'APPLIED' });
      expect(harness.applied).toHaveLength(1);
    });
  });

  it('n’applique rien quand l’enregistrement est refusé', async () => {
    // Since V4.5-199 the insert and the transition are one transaction, so a
    // duplicate does not merely skip the apply — it cannot reach it. The
    // earlier version of this test watched the two calls happen in order;
    // there is only one call now, and the property it was guarding is proven
    // where the transaction lives, in the ports test.
    const harness = build({ stored: false });

    await expect(run(harness)).resolves.toMatchObject({ kind: 'DUPLICATE' });
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
      orderId: null,
      paymentIntentId: 'pi_test_1',
      providerOrderId: 'ch_test_1',
    });
  });

  it('sépare notre identifiant de celui de Stripe sur un achat réel', async () => {
    // The shape a real Checkout produces: `client_reference_id` is the
    // PaymentOrder id we put on the session, `id` is Stripe's session id, and
    // `payment_intent` appears for the first time. Until V4.5-202 the last two
    // were collapsed, ours won, and the caller looked it up as a provider
    // identifier — so no purchase could ever be fulfilled.
    const harness = build();
    const completed = JSON.stringify({
      data: {
        object: {
          client_reference_id: 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60',
          id: 'cs_test_a1b2c3',
          payment_intent: 'pi_test_a1b2c3',
        },
      },
      id: 'evt_real_1',
      type: 'checkout.session.completed',
    });

    await run(harness, completed);

    expect(harness.ports.findOrder).toHaveBeenCalledWith({
      orderId: 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60',
      paymentIntentId: 'pi_test_a1b2c3',
      providerOrderId: 'cs_test_a1b2c3',
    });
    // And the intent is carried through, so a later refund can resolve.
    expect(harness.applied[0]).toMatchObject({
      paymentIntentId: 'pi_test_a1b2c3',
    });
  });

  it('résout un litige par le même identifiant', async () => {
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    await run(harness, disputeCreated);

    expect(harness.ports.findOrder).toHaveBeenCalledWith({
      orderId: null,
      paymentIntentId: 'pi_test_1',
      providerOrderId: 'dp_test_1',
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
        data: {
          object: {
            amount: 2000,
            amount_refunded: 2000,
            payment_intent: 'pi_test_1',
          },
        },
        id: 'evt_bare',
        type: 'charge.refunded',
      }),
    );

    expect(result).toMatchObject({ kind: 'APPLIED' });
  });

  it('ne compense pas un remboursement dont on ignore les montants', async () => {
    // Unknown amounts read as *not* full, deliberately (V4.5-203). Not
    // compensating leaves a person to settle it; compensating wrongly takes
    // credits the learner still paid for, and the ledger is never rewritten.
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    const result = await run(
      harness,
      JSON.stringify({
        data: { object: { payment_intent: 'pi_test_1' } },
        id: 'evt_bare_amounts',
        type: 'charge.refunded',
      }),
    );

    expect(result).toMatchObject({ kind: 'PARTIAL_REFUND' });
    expect(harness.compensated).toEqual([]);
    expect(harness.recorded[0]).toMatchObject({ outcome: 'PARTIAL_REFUND' });
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

describe('remboursement émis chez le fournisseur (V4.5-203)', () => {
  function refundPayload(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      data: {
        object: {
          amount: 2000,
          amount_refunded: 2000,
          payment_intent: 'pi_test_1',
          ...overrides,
        },
      },
      id: 'evt_refund_1',
      type: 'charge.refunded',
    });
  }

  it('compense un remboursement complet, sans passer par applyTransition', async () => {
    // The compensating entry is the point, not the status change. The refund
    // service writes both, conditionally, so a redelivery settles nothing
    // twice.
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    await expect(run(harness, refundPayload())).resolves.toMatchObject({
      attributed: false,
      kind: 'APPLIED',
      status: 'REFUNDED',
    });
    // Demandé DANS l'enregistrement, pas après lui (V4.5-211) : c'est ce qui
    // fait tomber le remboursement avec l'événement quand l'un des deux échoue.
    expect(harness.recorded[0]).toMatchObject({
      compensateRefundForOrderId: 'order-1',
    });
    expect(harness.compensated).toEqual(['order-1']);
    expect(harness.applied).toEqual([]);
  });

  it('ne rembourse rien quand l’enregistrement de l’événement est refusé', async () => {
    // V4.5-211. Le doublon n'écrit pas l'événement ; il ne doit pas non plus
    // reprendre des crédits. Avant, le remboursement vivait après la
    // transaction et pouvait s'exécuter seul.
    const harness = build({
      order: { id: 'order-1', status: 'FULFILLED' },
      stored: false,
    });

    await expect(run(harness, refundPayload())).resolves.toMatchObject({
      kind: 'DUPLICATE',
    });
    expect(harness.compensated).toEqual([]);
  });

  it('enregistre un remboursement partiel et n’applique rien', async () => {
    // `voluntaryRefundMinor` answers "everything unspent". On 5 € of a 20 €
    // order it would reclaim every remaining credit and book a refund larger
    // than the money that left, so a partial refund is recorded and left to a
    // person.
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    await expect(
      run(harness, refundPayload({ amount_refunded: 500 })),
    ).resolves.toMatchObject({ kind: 'PARTIAL_REFUND' });
    expect(harness.compensated).toEqual([]);
    expect(harness.applied).toEqual([]);
  });

  it('consigne le remboursement partiel sous son propre nom', async () => {
    // Not `applied`, which would be false, and not `out_of_order`, which would
    // dress the one case needing a human as the harmless one (V4.5-198).
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });

    await run(harness, refundPayload({ amount_refunded: 500 }));

    expect(harness.recorded[0]).toMatchObject({
      eventType: 'charge.refunded',
      outcome: 'PARTIAL_REFUND',
    });
  });

  it('ne compense pas deux fois quand la commande était déjà réglée', async () => {
    const harness = build({
      compensated: false,
      order: { id: 'order-1', status: 'FULFILLED' },
    });

    await expect(run(harness, refundPayload())).resolves.toMatchObject({
      kind: 'OUT_OF_ORDER',
    });
  });
});
