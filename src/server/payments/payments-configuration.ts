/**
 * Payment configuration (ADR_004 §6, §8).
 *
 * Off by default, and no value is assumed where the owner has not decided one.
 * A missing secret is not defaulted: a published webhook secret would accept
 * anyone's forged delivery, which is worse than accepting none.
 */

export interface PaymentsConfiguration {
  enabled: boolean;
  webhookSecret: string | null;
}

export function readPaymentsConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): PaymentsConfiguration {
  return {
    enabled: environment.LEARNX_PAYMENTS_ENABLED === 'true',
    webhookSecret: environment.STRIPE_TEST_WEBHOOK_SECRET?.trim() || null,
  };
}
