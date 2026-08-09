import {
  messageCatalogs,
  type MessageCatalog,
  type MessageKey,
} from '@/i18n/catalogs';

export const supportedUiLocales = ['fr', 'en'] as const;
export type UiLocale = (typeof supportedUiLocales)[number];
export type TranslationParameters = Readonly<Record<string, string | number>>;

export function normalizeUiLocale(locale: string | null | undefined): UiLocale {
  const language = locale?.trim().toLowerCase().split('-')[0];
  return language === 'en' ? 'en' : 'fr';
}

function selectMessage(
  catalog: MessageCatalog,
  locale: UiLocale,
  key: MessageKey,
  parameters: TranslationParameters,
): string {
  const value = catalog[key];
  if (typeof value === 'string') return value;

  const count = parameters.count;
  if (typeof count !== 'number') return value.other;

  return new Intl.PluralRules(locale).select(count) === 'one'
    ? value.one
    : value.other;
}

function interpolate(
  message: string,
  parameters: TranslationParameters,
): string {
  return message.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name) => {
    const value = parameters[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  locale: UiLocale,
  key: MessageKey,
  parameters: TranslationParameters = {},
): string {
  const catalog = messageCatalogs[locale] ?? messageCatalogs.fr;
  const message = selectMessage(catalog, locale, key, parameters);
  return interpolate(message, parameters);
}
