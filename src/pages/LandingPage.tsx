import type { FormEvent } from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { navigate as route } from '@/app/navigation';

import { TotemPublicShell } from '@/components/layout/TotemShell';
import {
  LessonPreview,
  ProgramPreview,
} from '@/components/landing/LandingPreviews';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';
import { Textarea } from '@/components/ui/Textarea';
import {
  usePublicLeadMutation,
  type PublicLeadPurpose,
} from '@/features/public-leads/public-leads';
import { isStandaloneDisplayMode } from '@/features/pwa/display-mode';
import { useI18n } from '@/i18n';
import { useRevealOnScroll } from '@/lib/use-reveal-on-scroll';

interface InterestFormProps {
  purpose: PublicLeadPurpose;
}

function InterestForm({ purpose }: InterestFormProps) {
  const { locale, t } = useI18n();
  const mutation = usePublicLeadMutation();
  const [email, setEmail] = useState('');
  const [motivation, setMotivation] = useState('');
  const early = purpose === 'EARLY_ADOPTER';

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      <p className="landing-form-status" role="status">
        {t(early ? 'landing.form.successEarly' : 'landing.form.successUpdates')}
      </p>
    );
  }

  return (
    <form className="landing-form" onSubmit={submit}>
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
        <Textarea
          className="min-h-32"
          id="early-motivation"
          label={t('landing.form.motivation')}
          maxLength={2000}
          minLength={20}
          onInput={(event) => setMotivation(event.currentTarget.value)}
          required
          value={motivation}
        />
      ) : null}
      <Checkbox
        className="landing-consent"
        label={
          early
            ? t('landing.form.consentEarly')
            : t('landing.form.consentUpdates')
        }
        required
      />
      {mutation.error ? (
        <p className="ui-text-danger" role="alert">
          {t('landing.form.error')}
        </p>
      ) : null}
      <Button className="w-full" isLoading={mutation.isPending} type="submit">
        {early ? t('landing.cta.early') : t('landing.cta.updates')}
      </Button>
      <p className="landing-privacy">{t('landing.form.privacy')}</p>
    </form>
  );
}

export function LandingPage({ path }: { path?: string }) {
  void path;
  const { locale, setLocale, t } = useI18n();
  const researchRule = useRevealOnScroll<HTMLDivElement>();
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
    <TotemPublicShell
      className="landing-page totem-public-landing"
      footer={
        <div className="landing-footer">
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
        </div>
      }
      navigation={
        <div className="landing-header">
          <a className="landing-brand" href="/">
            <img alt="" aria-hidden="true" src="/learnx-mark-on-paper.svg" />
            <span>LearnX</span>
          </a>
          <nav
            aria-label={t('landing.utilityNavigation')}
            className="landing-utility"
          >
            <div className="landing-primary-navigation">
              <a href="#product">{t('landing.navigation.product')}</a>
              <a href="#research">{t('landing.navigation.research')}</a>
              <a href="#roadmap">{t('landing.navigation.roadmap')}</a>
            </div>
            <div
              aria-label={t('landing.language')}
              className="landing-language"
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
            <a className="landing-signin" href="/login">
              {t('landing.login')}
            </a>
            <Button asChild size="sm">
              <a href="#early-adopter">{t('landing.cta.apply')}</a>
            </Button>
          </nav>
          <details className="landing-mobile-navigation">
            <summary>{t('landing.menu')}</summary>
            <nav aria-label={t('landing.utilityNavigation')}>
              <a href="#product">{t('landing.navigation.product')}</a>
              <a href="#research">{t('landing.navigation.research')}</a>
              <a href="#roadmap">{t('landing.navigation.roadmap')}</a>
              <button
                onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                type="button"
              >
                {locale === 'fr' ? 'EN' : 'FR'}
              </button>
              <a href="/login">{t('landing.login')}</a>
              <a className="landing-mobile-apply" href="#early-adopter">
                {t('landing.cta.apply')}
              </a>
            </nav>
          </details>
        </div>
      }
      skipLinkLabel={t('landing.skipToContent')}
    >
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="page-eyebrow">{t('landing.eyebrow')}</p>
          <h1>{t('landing.title')}</h1>
          <p className="landing-lead">{t('landing.lead')}</p>
          <div className="landing-actions">
            <Button asChild>
              <a href="#early-adopter">{t('landing.cta.early')}</a>
            </Button>
            <a className="landing-updates-action" href="#product">
              {t('landing.cta.howItWorks')}
            </a>
          </div>
          <p className="landing-hero-trust">{t('landing.hero.trust')}</p>
        </div>
        <div className="landing-hero-visual">
          <ProgramPreview />
        </div>
      </section>
      <section
        aria-label={t('landing.product.eyebrow')}
        className="landing-principles"
      >
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
        className="landing-section landing-feature-proof"
        id="product"
      >
        <div className="landing-product-copy">
          <p className="page-eyebrow">{t('landing.product.eyebrow')}</p>
          <h2 id="landing-product">{t('landing.product.title')}</h2>
          <p>{t('landing.product.description')}</p>
          <ul className="landing-product-benefits">
            <li>
              <strong>{t('landing.product.benefitDirectionTitle')}</strong>
              <span>{t('landing.product.benefitDirection')}</span>
            </li>
            <li>
              <strong>{t('landing.product.benefitPracticeTitle')}</strong>
              <span>{t('landing.product.benefitPractice')}</span>
            </li>
            <li>
              <strong>{t('landing.product.benefitContinuityTitle')}</strong>
              <span>{t('landing.product.benefitContinuity')}</span>
            </li>
          </ul>
        </div>
        <LessonPreview />
      </section>
      <section
        aria-labelledby="landing-roadmap"
        className="landing-section landing-roadmap"
        id="roadmap"
      >
        <div className="landing-roadmap-heading">
          <p className="page-eyebrow">{t('landing.roadmap.eyebrow')}</p>
          <h2 id="landing-roadmap">{t('landing.roadmap.title')}</h2>
          <p>{t('landing.roadmap.description')}</p>
        </div>
        <ol className="landing-roadmap-timeline">
          <li data-state="available">
            <span className="landing-roadmap-marker" aria-hidden="true" />
            <div>
              <p className="landing-roadmap-status">
                {t('landing.roadmap.available')}
              </p>
              <h3>{t('landing.roadmap.availableTitle')}</h3>
              <p>{t('landing.roadmap.availableDescription')}</p>
            </div>
          </li>
          <li data-state="current">
            <span className="landing-roadmap-marker" aria-hidden="true" />
            <div>
              <p className="landing-roadmap-status">
                {t('landing.roadmap.pilotLabel')}
              </p>
              <h3>{t('landing.roadmap.pilotTitle')}</h3>
              <p>{t('landing.roadmap.pilotDescription')}</p>
            </div>
          </li>
          <li>
            <span className="landing-roadmap-marker" aria-hidden="true" />
            <div>
              <p className="landing-roadmap-status">
                {t('landing.roadmap.nextLabel')}
              </p>
              <h3>{t('landing.roadmap.nextTitle')}</h3>
              <p>{t('landing.roadmap.nextDescription')}</p>
            </div>
          </li>
        </ol>
      </section>
      <section
        aria-labelledby="landing-research"
        className="landing-section landing-research"
        id="research"
      >
        <p className="page-eyebrow">{t('landing.research.eyebrow')}</p>
        <h2 id="landing-research">{t('landing.research.title')}</h2>
        <p>{t('landing.research.description')}</p>
        <div
          aria-hidden="true"
          className="landing-research-rule progress-rule"
          ref={researchRule}
        >
          <span />
        </div>
        <article className="landing-research-latest">
          <p className="landing-research-meta">
            {t('landing.research.latestMeta')}
          </p>
          <h3>{t('landing.research.latestTitle')}</h3>
          <p className="landing-research-finding">
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
            className="landing-research-action"
            data-native
            href={
              locale === 'en'
                ? '/research/ai-correction/en.html'
                : '/research/ai-correction/index.html'
            }
          >
            {t('landing.research.readVerdict')}
          </a>
        </article>
      </section>
      <section className="landing-forms">
        <article
          className="landing-form-card landing-form-card--primary"
          id="early-adopter"
        >
          <p className="page-eyebrow">{t('landing.early.eyebrow')}</p>
          <h2>{t('landing.early.title')}</h2>
          <p>{t('landing.early.description')}</p>
          <InterestForm purpose="EARLY_ADOPTER" />
        </article>
        <article
          className="landing-form-card landing-form-card--secondary"
          id="launch-updates"
        >
          <p className="page-eyebrow">{t('landing.updates.eyebrow')}</p>
          <h2>{t('landing.updates.title')}</h2>
          <p>{t('landing.updates.description')}</p>
          <InterestForm purpose="LAUNCH_UPDATES" />
        </article>
      </section>
    </TotemPublicShell>
  );
}
