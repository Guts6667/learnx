import { readPaymentsConfiguration } from './payments-configuration';

describe('readPaymentsConfiguration', () => {
  it('est coupé par défaut', () => {
    expect(readPaymentsConfiguration({})).toEqual({
      enabled: false,
      webhookSecret: null,
    });
  });

  it('lit le secret Stripe par défaut', () => {
    expect(
      readPaymentsConfiguration({
        LEARNX_PAYMENTS_ENABLED: 'true',
        STRIPE_TEST_WEBHOOK_SECRET: 'whsec_test',
      }),
    ).toEqual({ enabled: true, webhookSecret: 'whsec_test' });
  });

  it('ignore une variable d’un fournisseur qui n’existe plus', () => {
    // The Revolut adapter was removed in V4.5-184. A leftover variable in an
    // environment must not become a secret we verify against.
    expect(
      readPaymentsConfiguration({
        LEARNX_PAYMENTS_ENABLED: 'true',
        LEARNX_REVOLUT_WEBHOOK_SECRET: 'wsk_revolut',
      }),
    ).toEqual({ enabled: true, webhookSecret: null });
  });

  it('ne prend aucun secret par défaut', () => {
    // A published webhook secret would accept anyone's forged delivery, which
    // is worse than accepting none.
    expect(
      readPaymentsConfiguration({ LEARNX_PAYMENTS_ENABLED: 'true' })
        .webhookSecret,
    ).toBeNull();
  });
});
