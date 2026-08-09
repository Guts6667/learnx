import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useMemo } from 'preact/hooks';

import type { MessageKey } from '@/i18n/catalogs';
import {
  translate,
  type TranslationParameters,
  type UiLocale,
} from '@/i18n/i18n';

interface I18nContextValue {
  locale: UiLocale;
  t: (key: MessageKey, parameters?: TranslationParameters) => string;
}

interface I18nProviderProps {
  children: ComponentChildren;
  locale?: UiLocale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, locale = 'fr' }: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, parameters) => translate(locale, key, parameters),
    }),
    [locale],
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
