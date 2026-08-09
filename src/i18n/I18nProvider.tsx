import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';

import type { MessageKey } from '@/i18n/catalogs';
import {
  translate,
  type TranslationParameters,
  type UiLocale,
} from '@/i18n/i18n';

interface I18nContextValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey, parameters?: TranslationParameters) => string;
}

interface I18nProviderProps {
  children: ComponentChildren;
  locale?: UiLocale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, locale = 'fr' }: I18nProviderProps) {
  const [activeLocale, setActiveLocale] = useState(locale);

  useEffect(() => setActiveLocale(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = activeLocale;
    document.title = translate(activeLocale, 'app.documentTitle');
    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.head.appendChild(document.createElement('meta'));
    description.name = 'description';
    description.content = translate(activeLocale, 'app.description');

    const manifest =
      document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ??
      document.head.appendChild(document.createElement('link'));
    manifest.rel = 'manifest';
    manifest.href =
      activeLocale === 'en'
        ? '/manifest-en.webmanifest'
        : '/manifest.webmanifest';
  }, [activeLocale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale: activeLocale,
      setLocale: setActiveLocale,
      t: (key, parameters) => translate(activeLocale, key, parameters),
    }),
    [activeLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider.');
  }
  return context;
}
