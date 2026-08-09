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
});
