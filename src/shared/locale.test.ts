import {
  formatLocalizedDate,
  formatLocalizedNumber,
  normalizeLocale,
} from '@/shared/locale';

describe('account locale helpers', () => {
  it('uses a deterministic French fallback', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('de-DE')).toBe('fr');
    expect(normalizeLocale(undefined)).toBe('fr');
  });

  it('formats dates and numbers according to the account locale', () => {
    const date = new Date('2026-08-09T12:00:00.000Z');

    expect(formatLocalizedDate(date, 'fr', { dateStyle: 'long' })).toContain(
      'août',
    );
    expect(formatLocalizedDate(date, 'en', { dateStyle: 'long' })).toContain(
      'August',
    );
    expect(formatLocalizedNumber(1234.5, 'fr')).toContain(',');
    expect(formatLocalizedNumber(1234.5, 'en')).toContain('.');
  });
});
