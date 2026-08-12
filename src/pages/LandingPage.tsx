import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
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
        <div class="landing-preview-module">
          <strong>{t('landing.preview.program.module')}</strong>
          <ol>
            <li aria-current="step">
              <span>01</span>
              <strong>{t('landing.preview.lesson.title')}</strong>
            </li>
            <li>
              <span>02</span>
              <strong>{t('landing.preview.program.nextLesson')}</strong>
            </li>
          </ol>
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
  useEffect(() => {
    if (standalone) return;
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
  }, [locale, standalone, t]);

  if (standalone) return null;

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
          <div class="landing-hero-copy">
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
          </div>
          <ProgramPreview />
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
          aria-labelledby="landing-program-proof"
          class="landing-section landing-feature-proof"
        >
          <div>
            <p class="page-eyebrow">{t('landing.preview.program.type')}</p>
            <h2 id="landing-program-proof">
              {t('landing.preview.program.heading')}
            </h2>
            <p>{t('landing.preview.program.description')}</p>
          </div>
          <ProgramPreview />
        </section>
        <section
          aria-labelledby="landing-lesson-proof"
          class="landing-section landing-feature-proof"
        >
          <div>
            <p class="page-eyebrow">{t('landing.preview.lesson.type')}</p>
            <h2 id="landing-lesson-proof">
              {t('landing.preview.lesson.heading')}
            </h2>
            <p>{t('landing.preview.lesson.description')}</p>
          </div>
          <LessonPreview />
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
        <section
          aria-labelledby="landing-research"
          class="landing-section landing-research"
        >
          <div>
            <p class="page-eyebrow">{t('landing.research.eyebrow')}</p>
            <h2 id="landing-research">{t('landing.research.title')}</h2>
          </div>
          <div>
            <p>{t('landing.research.description')}</p>
            <a
              class="ui-action ui-action--secondary"
              href={
                locale === 'en'
                  ? '/research/ai-correction/en.html'
                  : '/research/ai-correction/'
              }
            >
              {t('landing.research.action')}
            </a>
          </div>
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
