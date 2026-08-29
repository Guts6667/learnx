import { handleRevolutWebhook } from './payment-webhook';
import { signRevolutPayload } from './revolut-webhook-signature';

const SECRET = 'wsk_sandbox_secret';
const NOW = new Date('2026-08-29T12:00:00.000Z');

function payloadFor(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: 'ORDER_COMPLETED',
    event_id: 'evt_1',
    order_id: 'ord_1',
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
  return { applied, ports, recorded, options };
}

function run(
  harness: ReturnType<typeof build>,
  payload = payloadFor(),
  headerOverrides: Record<string, unknown> = {},
) {
  return handleRevolutWebhook({
    configuration: {
      enabled: harness.options.enabled ?? true,
      webhookSecret:
        harness.options.secret === undefined ? SECRET : harness.options.secret,
    },
    now: NOW,
    ports: harness.ports as never,
    rawPayload: payload,
    signatureHeader: `v1=${signRevolutPayload({
      payload,
      secret: SECRET,
      timestamp: NOW.getTime(),
    })}`,
    timestampHeader: String(NOW.getTime()),
    ...headerOverrides,
  });
}

describe('handleRevolutWebhook', () => {
  it('attribue les crédits sur PAID et honore dans le même geste', async () => {
    // An order that reached PAID and stopped would be money taken with nothing
    // given, waiting on an event the provider has no reason to send.
    const harness = build();
    await expect(run(harness)).resolves.toEqual({
      attributed: true,
      kind: 'APPLIED',
      status: 'FULFILLED',
    });
    expect(harness.applied[0]).toMatchObject({
      attributeCredits: true,
      status: 'FULFILLED',
    });
  });

  it('ignore un FULFILLED du fournisseur après notre attribution', async () => {
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });
    await expect(
      run(harness, payloadFor({ event: 'ORDER_FULFILLED', event_id: 'evt_2' })),
    ).resolves.toEqual({ kind: 'OUT_OF_ORDER' });
    expect(harness.applied).toEqual([]);
  });

  it('n’attribue rien deux fois sur un événement rejoué', async () => {
    // The provider retries; the unique event id is what makes that harmless.
    const harness = build({ stored: false });
    await expect(run(harness)).resolves.toEqual({ kind: 'DUPLICATE' });
    expect(harness.applied).toEqual([]);
  });

  it('ne fait pas régresser une commande sur un événement désordonné', async () => {
    const harness = build({ order: { id: 'order-1', status: 'FULFILLED' } });
    await expect(run(harness)).resolves.toEqual({ kind: 'OUT_OF_ORDER' });
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
    await expect(
      run(harness, payloadFor(), {
        rawPayload: payloadFor({ order_id: 'ord_evil' }),
      }),
    ).resolves.toEqual({ kind: 'REJECTED', reason: 'SIGNATURE_MISMATCH' });
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
    await expect(run(harness)).resolves.toEqual({ kind: 'UNKNOWN_ORDER' });
    expect(harness.recorded[0]).toMatchObject({ orderId: null });
    expect(harness.applied).toEqual([]);
  });

  it('refuse un corps illisible après signature valide', async () => {
    const harness = build();
    await expect(run(harness, 'pas du JSON')).resolves.toEqual({
      kind: 'REJECTED',
      reason: 'MALFORMED_PAYLOAD',
    });
  });
});
