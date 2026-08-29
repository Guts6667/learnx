import { ownerAlert } from './owner-alert';

const configured = {
  ADMIN_EMAIL: 'owner@example.com',
  LEARNX_EMAIL_FROM: 'LearnX <alerts@example.com>',
  RESEND_API_KEY: 'resend-key',
};

describe('ownerAlert', () => {
  it('rend un canal quand tout est configuré', () => {
    expect(ownerAlert(configured)).toBeDefined();
  });

  it.each(['ADMIN_EMAIL', 'LEARNX_EMAIL_FROM', 'RESEND_API_KEY'])(
    'ne rend rien sans %s',
    (missing) => {
      // Undefined rather than a silent no-op: the breaker then records
      // ALERT_CHANNEL_NOT_CONFIGURED, so an environment that cannot alert says
      // so instead of appearing to have alerted.
      expect(ownerAlert({ ...configured, [missing]: '' })).toBeUndefined();
    },
  );
});
