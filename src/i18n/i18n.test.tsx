import { render, screen } from '@testing-library/preact';

import { frenchMessages } from '@/i18n/catalogs';
import { I18nProvider, normalizeUiLocale, translate, useI18n } from '@/i18n';

function InterpolationExample({ value }: { value: string }) {
  const { t } = useI18n();
  return <p>{t('i18n.example.itemCount', { count: value })}</p>;
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

  it('keeps the catalog large enough to cover the first migrated domain', () => {
    expect(Object.keys(frenchMessages).length).toBeGreaterThan(40);
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
});
