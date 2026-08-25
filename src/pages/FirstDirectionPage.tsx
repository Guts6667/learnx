import { route } from 'preact-router';
import { useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { useI18n, type UiLocale } from '@/i18n';

type FirstDirection = 'discover' | 'shared';

interface FirstDirectionPageProps {
  path?: string;
}

export function FirstDirectionPage({ path }: FirstDirectionPageProps) {
  void path;
  const { locale, setLocale, t } = useI18n();
  const [direction, setDirection] = useState<FirstDirection>('discover');

  function continueToProduct(event: SubmitEvent) {
    event.preventDefault();
    route(direction === 'discover' ? '/discover' : '/program', true);
  }

  return (
    <section aria-labelledby="first-direction-title" class="totem-auth-page">
      <header class="totem-auth-page__header">
        <p class="page-eyebrow">{t('auth.firstDirection.step')}</p>
        <h1 class="page-title" id="first-direction-title">
          {t('auth.firstDirection.title')}
        </h1>
        <p>{t('auth.firstDirection.description')}</p>
      </header>
      <form class="totem-auth-form" onSubmit={continueToProduct}>
        <fieldset class="totem-auth-choice-list">
          <legend class="sr-only">{t('auth.firstDirection.legend')}</legend>
          <label class="totem-auth-choice">
            <input
              checked={direction === 'discover'}
              name="firstDirection"
              onChange={() => setDirection('discover')}
              type="radio"
              value="discover"
            />
            <span>
              <strong>{t('auth.firstDirection.discoverTitle')}</strong>
              <small>{t('auth.firstDirection.discoverDescription')}</small>
            </span>
          </label>
          <label class="totem-auth-choice">
            <input
              checked={direction === 'shared'}
              name="firstDirection"
              onChange={() => setDirection('shared')}
              type="radio"
              value="shared"
            />
            <span>
              <strong>{t('auth.firstDirection.sharedTitle')}</strong>
              <small>{t('auth.firstDirection.sharedDescription')}</small>
            </span>
          </label>
        </fieldset>
        <label class="ui-field">
          <span class="ui-field__label">
            {t('auth.firstDirection.language')}
          </span>
          <select
            class="ui-field__control"
            onChange={(event) =>
              setLocale(event.currentTarget.value as UiLocale)
            }
            value={locale}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
        <Button class="w-full" type="submit">
          {t('common.continue')} <span aria-hidden="true">→</span>
        </Button>
        <button
          class="totem-auth-skip"
          onClick={() => route('/today', true)}
          type="button"
        >
          {t('auth.firstDirection.later')}
        </button>
      </form>
    </section>
  );
}
