import { Fragment } from 'react';

import { TotemPublicShell } from '@/components/layout/TotemShell';
import { privacyPolicy } from '@/features/legal/privacy-policy';
import { useI18n } from '@/i18n';

/**
 * Politique de confidentialité (V4.5-167). Publique, sans compte.
 *
 * La langue suit celle de l'interface, pas la route : `/confidentialite` et
 * `/privacy` rendent la même page. Servir un texte juridique dans une langue
 * que le lecteur n'a pas choisie serait pire que de le servir sous une URL
 * dont la langue ne correspond pas à la sienne.
 */
/**
 * Le document met en gras des mots juridiquement porteurs. Les rendre en texte
 * simple appauvrirait une lecture dont chaque nuance a été arbitrée.
 */
function Fragments({
  fragments,
}: {
  fragments: { strong?: boolean; text: string }[];
}) {
  return (
    <>
      {fragments.map((fragment) =>
        fragment.strong ? (
          <strong key={fragment.text}>{fragment.text}</strong>
        ) : (
          // Pas de <span> : un texte simple n'a pas besoin d'un élément, et
          // en émettre un ferait correspondre deux nœuds à la même phrase.
          <Fragment key={fragment.text}>{fragment.text}</Fragment>
        ),
      )}
    </>
  );
}

export function PrivacyPolicyPage() {
  const { locale, t } = useI18n();
  const content = privacyPolicy[locale === 'en' ? 'en' : 'fr'];

  return (
    <TotemPublicShell
      className="legal-page"
      footer={
        <div className="landing-footer">
          <span>© 2026 LearnX</span>
          <nav aria-label={t('landing.footerNavigation')}>
            <a href="/">{t('legal.backHome')}</a>
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
        </div>
      }
    >
      <article className="legal-article">
        <header className="legal-article__header">
          <p className="page-eyebrow">{t('legal.privacyEyebrow')}</p>
          <h1 className="page-title">{content.title}</h1>
          <p className="legal-article__updated">{content.updated}</p>
        </header>

        {content.sections.map((section) => (
          <section className="legal-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body ? (
              <p>
                <Fragments fragments={section.body} />
              </p>
            ) : null}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet.map((part) => part.text).join('')}>
                    <Fragments fragments={bullet} />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </TotemPublicShell>
  );
}
