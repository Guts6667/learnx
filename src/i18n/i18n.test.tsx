import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { frenchMessages } from '@/i18n/catalogs';
import { I18nProvider, normalizeUiLocale, translate, useI18n } from '@/i18n';

function InterpolationExample({ value }: { value: string }) {
  const { t } = useI18n();
  return <p>{t('i18n.example.itemCount', { count: value })}</p>;
}

/**
 * Reproduit le chemin réel du changement de langue : la langue est rétablie
 * depuis le `catch` d'une mutation, donc en dehors de tout gestionnaire
 * d'événement React.
 */
function LateSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      onClick={() => {
        void Promise.reject(new Error('refus du serveur')).catch(() =>
          setLocale('en'),
        );
      }}
      type="button"
    >
      {locale}
    </button>
  );
}

describe('i18n foundation', () => {
  it('normalizes supported languages and falls back safely to French', () => {
    expect(normalizeUiLocale('en-US')).toBe('en');
    expect(normalizeUiLocale('fr-CA')).toBe('fr');
    expect(normalizeUiLocale('de-DE')).toBe('fr');
    expect(normalizeUiLocale(undefined)).toBe('fr');
  });

  it('selects plural forms and interpolates values in both languages', () => {
    expect(translate('fr', 'i18n.example.itemCount', { count: 1 })).toBe(
      '1 élément',
    );
    expect(translate('fr', 'i18n.example.itemCount', { count: 3 })).toBe(
      '3 éléments',
    );
    expect(translate('en', 'i18n.example.itemCount', { count: 1 })).toBe(
      '1 item',
    );
    expect(translate('en', 'i18n.example.itemCount', { count: 3 })).toBe(
      '3 items',
    );
  });

  it('renders interpolated user values as text without creating HTML', () => {
    const maliciousValue = '<img src=x onerror=alert(1)>';
    render(
      <I18nProvider locale="en">
        <InterpolationExample value={maliciousValue} />
      </I18nProvider>,
    );

    expect(screen.getByText(`${maliciousValue} items`)).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  it('keeps the catalog large enough to cover all authenticated surfaces', () => {
    expect(Object.keys(frenchMessages).length).toBeGreaterThan(500);
  });

  it('synchronizes document and PWA metadata with the active locale', async () => {
    render(
      <I18nProvider locale="en">
        <p>content</p>
      </I18nProvider>,
    );

    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('LearnX — Personal learning journey');
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest-en.webmanifest',
    );
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.content,
    ).toContain('personal environment');
  });

  it('n’affiche jamais une langue que l’attribut du document contredit', async () => {
    // V4.5-188. `lang` était écrit par un effet passif : l'ordonnanceur le
    // planifie dans une tâche suivante, un cran après le commit qui affiche
    // déjà la nouvelle langue. Dans cet intervalle, le document en annonce une
    // et en affiche une autre — ce que lisent les lecteurs d'écran et la
    // césure typographique. C'est aussi ce qui rendait `App.test.tsx` instable
    // en CI : l'assertion tombait dans cet intervalle, d'autant plus large que
    // la machine est chargée.
    render(
      <I18nProvider>
        <LateSwitcher />
      </I18nProvider>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('fr');

    // Le `MutationObserver` est livré en micro-tâche, donc après le commit et
    // ses effets de disposition, mais avant la tâche des effets passifs. Il
    // observe précisément l'instant où le texte change : c'est la fenêtre où
    // l'attribut ne doit déjà plus mentir.
    let langWhenTextChanged: string | null = null;
    const observer = new MutationObserver(() => {
      if (langWhenTextChanged === null && button.textContent === 'en') {
        langWhenTextChanged = document.documentElement.lang;
      }
    });
    observer.observe(button, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('en'));
    observer.disconnect();

    expect(langWhenTextChanged).toBe('en');
  });
});
