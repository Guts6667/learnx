import { useI18n } from '@/i18n';

export function ProgramPreview() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t('landing.preview.program.ariaLabel')}
      className="landing-product-preview landing-program-preview"
    >
      <header className="landing-preview-header">
        <div className="landing-preview-program-title">
          <span aria-hidden="true" className="landing-preview-program-mark" />
          <h2>{t('landing.preview.program.title')}</h2>
        </div>
        <span>{t('landing.preview.program.activity')}</span>
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
          <header className="landing-preview-route-heading">
            <p className="landing-preview-kicker">
              {t('landing.preview.program.greeting')}
            </p>
            <h3>{t('landing.preview.program.nextStep')}</h3>
          </header>
          <ol className="landing-preview-path">
            <li data-state="context">
              <span
                aria-hidden="true"
                className="landing-preview-path-marker"
              />
              <div className="landing-preview-path-copy">
                <p className="landing-preview-kicker">
                  {t('landing.preview.program.stage')}
                </p>
                <strong>{t('landing.preview.program.module')}</strong>
              </div>
            </li>
            <li aria-current="step" data-state="current">
              <span
                aria-hidden="true"
                className="landing-preview-path-marker"
              />
              <article className="landing-next-card">
                <h4>{t('landing.preview.lesson.title')}</h4>
                <p>{t('landing.preview.program.saved')}</p>
                <div aria-hidden="true" className="landing-preview-progress">
                  <span />
                </div>
                <span className="landing-preview-next-action">
                  {t('landing.preview.program.resume')}
                  <span aria-hidden="true">→</span>
                </span>
              </article>
            </li>
            <li data-state="next">
              <span
                aria-hidden="true"
                className="landing-preview-path-marker"
              />
              <p className="landing-preview-path-next">
                <span aria-hidden="true">→</span>
                <strong>{t('landing.preview.program.nextLesson')}</strong>
              </p>
            </li>
          </ol>
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
        <span>{t('landing.preview.lesson.type')}</span>
        <span>{t('landing.preview.realContent')}</span>
      </header>
      <div className="landing-preview-body">
        <p className="landing-preview-kicker">
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
