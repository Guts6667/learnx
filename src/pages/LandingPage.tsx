import { useEffect, useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  usePublicLeadMutation,
  type PublicLeadPurpose,
} from '@/features/public-leads/public-leads';
import { useI18n } from '@/i18n';

interface InterestFormProps {
  purpose: PublicLeadPurpose;
}

function InterestForm({ purpose }: InterestFormProps) {
  const { locale, t } = useI18n();
  const mutation = usePublicLeadMutation();
  const [email, setEmail] = useState('');
  const [motivation, setMotivation] = useState('');
  const early = purpose === 'EARLY_ADOPTER';

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({
        consent: true,
        email,
        locale,
        motivation: early ? motivation : undefined,
        purpose,
      });
    } catch {
      // Accessible state below exposes the normalized error without leaking details.
    }
  }

  if (mutation.isSuccess) {
    return (
      <p class="landing-form-status" role="status">
        {t('landing.form.success')}
      </p>
    );
  }

  return (
    <form class="landing-form" onSubmit={submit}>
      <TextField
        autoComplete="email"
        label={t('landing.form.email')}
        name={`${purpose.toLowerCase()}-email`}
        onInput={(event) => setEmail(event.currentTarget.value)}
        required
        type="email"
        value={email}
      />
      {early ? (
        <div class="ui-field">
          <label class="ui-field__label" for="early-motivation">
            {t('landing.form.motivation')}
          </label>
          <textarea
            class="ui-field__control min-h-32"
            id="early-motivation"
            minlength={20}
            maxlength={2000}
            onInput={(event) => setMotivation(event.currentTarget.value)}
            required
            value={motivation}
          />
        </div>
      ) : null}
      <label class="landing-consent">
        <input required type="checkbox" />
        <span>
          {early
            ? t('landing.form.consentEarly')
            : t('landing.form.consentUpdates')}
        </span>
      </label>
      {mutation.error ? (
        <p class="text-red-800" role="alert">
          {t('landing.form.error')}
        </p>
      ) : null}
      <Button class="w-full" isLoading={mutation.isPending} type="submit">
        {early ? t('landing.cta.early') : t('landing.cta.updates')}
      </Button>
      <p class="landing-privacy">{t('landing.form.privacy')}</p>
    </form>
  );
}

export function LandingPage({ path }: { path?: string }) {
  void path;
  const { locale, setLocale, t } = useI18n();
  useEffect(() => {
    document.title =
      locale === 'en'
        ? 'LearnX — A journey, not a library'
        : 'LearnX — Un parcours, pas une bibliothèque';
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description) description.content = t('landing.lead');
    return () => {
      document.title = t('app.documentTitle');
      if (description) description.content = t('app.description');
    };
  }, [locale, t]);
  return (
    <div class="landing-page" data-color-regime="paper">
      <header class="landing-header">
        <a class="landing-brand" href="/">
          LearnX
        </a>
        <nav
          aria-label={t('landing.utilityNavigation')}
          class="landing-utility"
        >
          <div
            aria-label={t('landing.language')}
            class="landing-language"
            role="group"
          >
            <button
              aria-pressed={locale === 'fr'}
              onClick={() => setLocale('fr')}
              type="button"
            >
              FR
            </button>
            <button
              aria-pressed={locale === 'en'}
              onClick={() => setLocale('en')}
              type="button"
            >
              EN
            </button>
          </div>
          <a href="/login">{t('landing.login')}</a>
        </nav>
      </header>
      <main id="main-content" tabindex={-1}>
        <section class="landing-hero">
          <p class="page-eyebrow">{t('landing.eyebrow')}</p>
          <h1>{t('landing.title')}</h1>
          <p class="landing-lead">{t('landing.lead')}</p>
          <div class="landing-actions">
            <a class="ui-action ui-action--primary" href="#early-adopter">
              {t('landing.cta.early')}
            </a>
            <a class="ui-action ui-action--secondary" href="#launch-updates">
              {t('landing.cta.updates')}
            </a>
          </div>
        </section>
        <section aria-labelledby="landing-product" class="landing-section">
          <div>
            <p class="page-eyebrow">{t('landing.product.eyebrow')}</p>
            <h2 id="landing-product">{t('landing.product.title')}</h2>
            <p>{t('landing.product.description')}</p>
          </div>
          <ul class="landing-proof-list">
            <li>
              <strong>{t('landing.product.structuredTitle')}</strong>
              <span>{t('landing.product.structured')}</span>
            </li>
            <li>
              <strong>{t('landing.product.practiceTitle')}</strong>
              <span>{t('landing.product.practice')}</span>
            </li>
            <li>
              <strong>{t('landing.product.evidenceTitle')}</strong>
              <span>{t('landing.product.evidence')}</span>
            </li>
          </ul>
        </section>
        <section
          aria-labelledby="landing-roadmap"
          class="landing-section landing-section--muted"
        >
          <div>
            <p class="page-eyebrow">{t('landing.roadmap.eyebrow')}</p>
            <h2 id="landing-roadmap">{t('landing.roadmap.title')}</h2>
          </div>
          <p>{t('landing.roadmap.description')}</p>
        </section>
        <section class="landing-forms">
          <article id="early-adopter">
            <p class="page-eyebrow">{t('landing.early.eyebrow')}</p>
            <h2>{t('landing.early.title')}</h2>
            <p>{t('landing.early.description')}</p>
            <InterestForm purpose="EARLY_ADOPTER" />
          </article>
          <article id="launch-updates">
            <p class="page-eyebrow">{t('landing.updates.eyebrow')}</p>
            <h2>{t('landing.updates.title')}</h2>
            <p>{t('landing.updates.description')}</p>
            <InterestForm purpose="LAUNCH_UPDATES" />
          </article>
        </section>
      </main>
      <footer class="landing-footer">
        <span>© 2026 LearnX</span>
        <a href="/login">{t('landing.login')}</a>
      </footer>
    </div>
  );
}
