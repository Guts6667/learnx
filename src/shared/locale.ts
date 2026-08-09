export const supportedLocales = ['fr', 'en'] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export function normalizeLocale(
  value: string | null | undefined,
): SupportedLocale {
  return value?.trim().toLowerCase().split('-')[0] === 'en' ? 'en' : 'fr';
}

export function toIntlLocale(locale: SupportedLocale): string {
  return locale === 'en' ? 'en-GB' : 'fr-FR';
}

export function formatLocalizedDate(
  value: Date | number | string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(
    value instanceof Date ? value : new Date(value),
  );
}

export function formatLocalizedNumber(
  value: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}
