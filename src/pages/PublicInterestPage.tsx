import { useEffect, useState } from 'react';

import { PublicPageShell } from '@/components/layout/PublicPageShell';
import { Button } from '@/components/ui/Button';
import { applyPublicLeadAction } from '@/features/public-leads/public-leads';
import { useI18n } from '@/i18n';

export function PublicInterestPage({ path }: { path?: string }) {
  void path;
  const { t } = useI18n();
  const [state, setState] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const action = parameters.get('action');
    const token = parameters.get('token');
    if (
      !token ||
      !['confirm', 'unsubscribe', 'delete'].includes(action ?? '')
    ) {
      setState('error');
      return;
    }
    void applyPublicLeadAction(
      action as 'confirm' | 'unsubscribe' | 'delete',
      token,
    )
      .then(() => {
        window.history.replaceState({}, '', '/interest');
        setState('success');
      })
      .catch(() => setState('error'));
  }, []);
  return (
    <PublicPageShell className="landing-page landing-action-shell">
      <section className="landing-action-page" aria-live="polite">
        <h1>
          {state === 'loading'
            ? t('landing.manage.loading')
            : state === 'success'
              ? t('landing.manage.success')
              : t('landing.manage.error')}
        </h1>
        <p>
          {state === 'success'
            ? t('landing.manage.successDescription')
            : state === 'error'
              ? t('landing.manage.errorDescription')
              : t('landing.manage.loadingDescription')}
        </p>
        <Button asChild variant="secondary">
          <a href="/">{t('landing.manage.back')}</a>
        </Button>
      </section>
    </PublicPageShell>
  );
}
