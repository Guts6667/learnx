import {
  ResendEmailProvider,
  type OwnerAlertEmailProvider,
} from '../email/email-provider.js';
import type { BreakerAlertPort } from './correction-breaker.js';

/**
 * The owner alert channel, or nothing when e-mail is not configured.
 *
 * Returning undefined rather than a silent no-op provider is deliberate: the
 * breaker records ALERT_CHANNEL_NOT_CONFIGURED in its journal, so an
 * environment that cannot alert says so instead of appearing to have alerted.
 */
export function ownerAlert(
  values: Record<string, string | undefined> = process.env,
): BreakerAlertPort | undefined {
  const apiKey = values.RESEND_API_KEY?.trim();
  const from = values.LEARNX_EMAIL_FROM?.trim();
  const recipientEmail = values.ADMIN_EMAIL?.trim();
  if (!apiKey || !from || !recipientEmail) return undefined;

  const provider: OwnerAlertEmailProvider = new ResendEmailProvider({
    apiKey,
    from,
  });
  return {
    async send(input) {
      await provider.sendOwnerAlertEmail({ ...input, recipientEmail });
    },
  };
}
