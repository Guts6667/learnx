import { useI18n } from '@/i18n';

function PreviewWindowControls() {
  return (
    <span aria-hidden="true" className="landing-preview-window-controls">
      <span />
      <span />
      <span />
    </span>
  );
}

export function ProgramPreview() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t('landing.preview.program.ariaLabel')}
      className="landing-product-preview landing-program-preview"
    >
      <header className="landing-preview-header landing-preview-header--program">
        <PreviewWindowControls />
        <span className="landing-preview-brand">
          <span aria-hidden="true" className="landing-preview-brand-mark">
            X
          </span>
          <strong>LearnX</strong>
        </span>
        <span className="landing-preview-activity">
          {t('landing.preview.program.activity')}
        </span>
      </header>

      <div className="landing-preview-body">
        <nav
          aria-label={t('landing.preview.productNavigation')}
          className="landing-preview-mini-nav"
        >
          <span aria-hidden="true">⌂</span>
          <span aria-current="page" aria-hidden="true">
            ◇
          </span>
          <span aria-hidden="true">↻</span>
          <span aria-hidden="true">▤</span>
        </nav>

        <div className="landing-preview-content">
          <div className="landing-preview-topline">
            <p className="landing-preview-kicker">
              {t('landing.preview.program.nextStep')}
            </p>
            <span className="landing-preview-greeting">
              {t('landing.preview.program.greeting')}
            </span>
          </div>

          <h2>{t('landing.preview.program.title')}</h2>

          <div className="landing-preview-route-summary">
            <span>{t('landing.preview.program.stage')}</span>
            <strong>{t('landing.preview.program.module')}</strong>
          </div>

          <div aria-hidden="true" className="landing-preview-progress">
            <span />
          </div>

          <ol className="landing-preview-path">
            <li data-state="complete">
              <span aria-hidden="true" className="landing-preview-path-marker">
                ✓
              </span>
              <div>
                <span>{t('landing.preview.program.stage')}</span>
                <strong>{t('landing.preview.program.module')}</strong>
              </div>
            </li>

            <li data-state="current">
              <span aria-hidden="true" className="landing-preview-path-marker">
                2
              </span>
              <article className="landing-next-card">
                <p className="landing-preview-kicker">
                  {t('landing.preview.program.nextStep')}
                </p>
                <h3>{t('landing.preview.lesson.title')}</h3>
                <p>{t('landing.preview.program.saved')}</p>
                <span className="landing-preview-next-action">
                  {t('landing.preview.program.resume')}
                  <span aria-hidden="true">→</span>
                </span>
              </article>
            </li>

            <li data-state="next">
              <span aria-hidden="true" className="landing-preview-path-marker">
                3
              </span>
              <div>
                <span>{t('landing.preview.program.nextStep')}</span>
                <strong>{t('landing.preview.program.nextLesson')}</strong>
              </div>
            </li>
          </ol>

          <footer className="landing-preview-caption">
            <strong>{t('landing.preview.program.heading')}</strong>
            <span>{t('landing.preview.program.description')}</span>
          </footer>
        </div>
      </div>
    </section>
  );
}

export function LessonPreview() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t('landing.preview.lesson.ariaLabel')}
      className="landing-product-preview landing-lesson-preview"
    >
      <header className="landing-preview-header">
        <span className="landing-preview-header-label">
          <PreviewWindowControls />
          {t('landing.preview.lesson.type')}
        </span>
        <span>{t('landing.preview.realContent')}</span>
      </header>

      <div className="landing-preview-body">
        <div className="landing-lesson-context">
          <p className="landing-preview-kicker">
            {t('landing.preview.lesson.module')}
          </p>
          <span aria-hidden="true">01</span>
        </div>

        <h2>{t('landing.preview.lesson.title')}</h2>

        <article>
          <span aria-hidden="true" className="landing-lesson-reading-rule" />
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
