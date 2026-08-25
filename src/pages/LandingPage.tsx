import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { TotemTheme } from '@/components/ui/TotemTheme';
import {
  usePublicLeadMutation,
  type PublicLeadPurpose,
} from '@/features/public-leads/public-leads';
import { isStandaloneDisplayMode } from '@/features/pwa/display-mode';
import { useI18n } from '@/i18n';

interface InterestFormProps {
  purpose: PublicLeadPurpose;
}

function ProgramPreview() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t('landing.preview.program.ariaLabel')}
      class="landing-product-preview landing-program-preview"
    >
      <header class="landing-preview-header">
        <span>{t('landing.preview.program.type')}</span>
        <span>{t('landing.preview.realContent')}</span>
      </header>
      <div class="landing-preview-body">
        <p class="landing-preview-kicker">
          {t('landing.preview.program.stage')}
        </p>
        <h2>{t('landing.preview.program.title')}</h2>
        <p class="landing-preview-meta">
          {t('landing.preview.program.module')}
        </p>
        <div class="landing-program-step" aria-current="step">
          <span class="landing-step-number">01</span>
          <div>
            <strong>{t('landing.preview.lesson.title')}</strong>
            <span>{t('landing.preview.program.nextLesson')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function LessonPreview() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t('landing.preview.lesson.ariaLabel')}
      class="landing-product-preview landing-lesson-preview"
    >
      <header class="landing-preview-header">
        <span>{t('landing.preview.lesson.type')}</span>
        <span>{t('landing.preview.realContent')}</span>
      </header>
      <div class="landing-preview-body">
        <p class="landing-preview-kicker">
          {t('landing.preview.lesson.module')}
        </p>
        <h2>{t('landing.preview.lesson.title')}</h2>
        <article>
          <h3>{t('landing.preview.lesson.section')}</h3>
          <p>{t('landing.preview.lesson.excerpt')}</p>
          <footer>
            <strong>{t('landing.preview.lesson.sourceLabel')}</strong>
            <cite>{t('landing.preview.lesson.source')}</cite>
          </footer>
        </article>
      </div>
    </section>
  );
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
        {t(early ? 'landing.form.successEarly' : 'landing.form.successUpdates')}
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
        <p class="ui-text-danger" role="alert">
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
  const standalone = isStandaloneDisplayMode();
  useEffect(() => {
    if (standalone) route('/today', true);
  }, [standalone]);
  useLayoutEffect(() => {
    if (standalone) return;
    document.documentElement.dataset.documentMetadataOwner = 'page';
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    document.title =
      locale === 'en'
        ? 'LearnX — Your path to knowledge'
        : 'LearnX — Votre chemin vers la connaissance';
    if (description) description.content = t('landing.lead');
    return () => {
      delete document.documentElement.dataset.documentMetadataOwner;
      document.title = t('app.documentTitle');
      if (description) description.content = t('app.description');
    };
  }, [locale, standalone, t]);

  if (standalone) return null;

  return (
    <TotemTheme class="landing-page totem-public-landing">
      <a class="public-skip-link" href="#main-content">
        {t('landing.skipToContent')}
      </a>
      <header class="landing-header">
        <a class="landing-brand" href="/">
          <img alt="" aria-hidden="true" src="/learnx-mark-on-paper.svg" />
          <span>LearnX</span>
        </a>
        <nav
          aria-label={t('landing.utilityNavigation')}
          class="landing-utility"
        >
          <div class="landing-primary-navigation">
            <a href="#product">{t('landing.navigation.product')}</a>
            <a href="#research">{t('landing.navigation.research')}</a>
            <a href="#roadmap">{t('landing.navigation.roadmap')}</a>
          </div>
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
        <details class="landing-mobile-navigation">
          <summary>{t('landing.menu')}</summary>
          <nav aria-label={t('landing.utilityNavigation')}>
            <a href="#product">{t('landing.navigation.product')}</a>
            <a href="#research">{t('landing.navigation.research')}</a>
            <a href="#roadmap">{t('landing.navigation.roadmap')}</a>
            <button onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')} type="button">
              {locale === 'fr' ? 'EN' : 'FR'}
            </button>
            <a href="/login">{t('landing.login')}</a>
          </nav>
        </details>
      </header>
      <main id="main-content" tabindex={-1}>
        <section class="landing-hero">
          <div class="landing-hero-copy">
            <p class="page-eyebrow">{t('landing.eyebrow')}</p>
            <h1>{t('landing.title')}</h1>
            <p class="landing-lead">{t('landing.lead')}</p>
            <div class="landing-actions">
              <a class="ui-action ui-action--primary" href="#early-adopter">
                {t('landing.cta.early')}
              </a>
              <a class="landing-updates-action" href="#launch-updates">
                {t('landing.cta.updates')}
              </a>
            </div>
          </div>
          <div class="landing-hero-visual">
            <ProgramPreview />
          </div>
        </section>
        <section aria-label={t('landing.product.eyebrow')} class="landing-principles">
          <div>
            <strong>{t('landing.product.structuredTitle')}</strong>
            <span>{t('landing.product.structured')}</span>
          </div>
          <div>
            <strong>{t('landing.product.practiceTitle')}</strong>
            <span>{t('landing.product.practice')}</span>
          </div>
          <div>
            <strong>{t('landing.product.evidenceTitle')}</strong>
            <span>{t('landing.product.evidence')}</span>
          </div>
        </section>
        <section
          aria-labelledby="landing-product"
          class="landing-section landing-feature-proof"
          id="product"
        >
          <div>
            <p class="page-eyebrow">{t('landing.product.eyebrow')}</p>
            <h2 id="landing-product">{t('landing.product.title')}</h2>
            <p>{t('landing.product.description')}</p>
          </div>
          <LessonPreview />
        </section>
        <section
          aria-labelledby="landing-roadmap"
          class="landing-section landing-roadmap"
          id="roadmap"
        >
          <div>
            <p class="page-eyebrow">{t('landing.roadmap.eyebrow')}</p>
            <h2 id="landing-roadmap">{t('landing.roadmap.title')}</h2>
          </div>
          <p>{t('landing.roadmap.description')}</p>
        </section>
        <section
          aria-labelledby="landing-research"
          class="landing-section landing-research"
          id="research"
        >
          <p class="page-eyebrow">{t('landing.research.eyebrow')}</p>
          <h2 id="landing-research">{t('landing.research.title')}</h2>
          <p>{t('landing.research.description')}</p>
          <article class="landing-research-latest">
            <p class="landing-research-meta">
              {t('landing.research.latestMeta')}
            </p>
            <h3>{t('landing.research.latestTitle')}</h3>
            <p class="landing-research-finding">
              <strong>
                {t('landing.research.verdictLabel')} :{' '}
                {t('landing.research.verdict')}
              </strong>
              <span>
                {t('landing.research.decisionLabel')} :{' '}
                {t('landing.research.decision')}
              </span>
            </p>
            <a
              class="landing-research-action"
              data-native
              href={
                locale === 'en'
                  ? '/research/ai-correction/en.html'
                  : '/research/ai-correction/index.html'
              }
            >
              {t('landing.research.action')}
            </a>
          </article>
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
        <nav aria-label={t('landing.footerNavigation')}>
          <a
            data-native
            href={
              locale === 'en'
                ? '/research/ai-correction/en.html'
                : '/research/ai-correction/index.html'
            }
          >
            {t('landing.navigation.research')}
          </a>
          <a href="/login">{t('landing.login')}</a>
        </nav>
      </footer>
    </TotemTheme>
  );
}
