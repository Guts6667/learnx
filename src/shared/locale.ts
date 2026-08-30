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

/**
 * Un entier arrivé sous forme de chaîne — un nombre de crédits — groupé selon
 * la locale sans passer par un `number`.
 *
 * Ces valeurs sont des `BigInt` côté serveur : `Number('9007199254740993')`
 * rendrait un autre nombre, en silence. Écrit trois fois dans trois écrans
 * avant d'être posé ici (V4.5-206).
 */
export function formatWholeNumber(
  value: string,
  locale: SupportedLocale,
): string {
  return BigInt(value).toLocaleString(toIntlLocale(locale));
}

/**
 * Un montant en plus petite unité monétaire, rendu sans jamais passer par un
 * nombre flottant.
 *
 * Les montants voyagent en chaînes parce que ce sont des `BigInt` de centimes
 * côté serveur ; les convertir en `number` pour les diviser par cent, c'est
 * accepter qu'un jour un centime disparaisse dans un arrondi binaire que
 * personne n'a demandé. On insère donc la virgule à la main et on passe la
 * chaîne décimale à `Intl.NumberFormat`, qui l'accepte depuis Intl v3.
 *
 * Écrit pour l'écran de remboursement (V4.5-162), partagé ici avec l'écran
 * d'achat (V4.5-204) : deux copies de cette règle seraient deux copies à
 * garder justes.
 */
export function formatMinorAmount(
  minor: string,
  currency: string,
  locale: SupportedLocale,
): string {
  const negative = minor.startsWith('-');
  const digits = (negative ? minor.slice(1) : minor).padStart(3, '0');
  const decimal = `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
  return new Intl.NumberFormat(toIntlLocale(locale), {
    currency,
    style: 'currency',
  }).format(decimal as unknown as number);
}
