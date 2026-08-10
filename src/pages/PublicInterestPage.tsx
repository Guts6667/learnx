import { useEffect, useState } from 'preact/hooks';

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
    <div class="landing-page" data-color-regime="paper">
      <main class="landing-action-page" id="main-content" tabindex={-1}>
        <a class="landing-brand" href="/">
          LearnX
        </a>
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
        <a class="ui-action ui-action--secondary" href="/">
          {t('landing.manage.back')}
        </a>
      </main>
    </div>
  );
}
