import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatMinorAmount,
  formatWholeNumber,
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

  /**
   * Les montants restent des chaînes de centimes de bout en bout. Le test
   * porte sur ce point précis : aucun `Number` n'est fabriqué en chemin, donc
   * aucun centime ne peut disparaître dans un arrondi binaire.
   */
  it('groupe un entier venu en chaîne sans le convertir en nombre', () => {
    const normalize = (value: string) => value.replace(/\s/gu, ' ');

    expect(normalize(formatWholeNumber('1200', 'fr'))).toBe('1 200');
    expect(formatWholeNumber('1200', 'en')).toBe('1,200');
    // Au-delà de l'entier exact de JavaScript : `Number` rendrait ici un autre
    // nombre, en silence, et c'est un nombre de crédits.
    expect(formatWholeNumber('9007199254740993', 'en')).toBe(
      '9,007,199,254,740,993',
    );
  });

  it('rend un montant en centimes sans jamais passer par un flottant', () => {
    const normalize = (value: string) => value.replace(/\s/gu, '');

    expect(normalize(formatMinorAmount('1900', 'EUR', 'fr'))).toBe('19,00€');
    expect(normalize(formatMinorAmount('1900', 'EUR', 'en'))).toBe('€19.00');
    // Moins d'un euro : les centimes seuls doivent garder leur zéro de tête.
    expect(normalize(formatMinorAmount('7', 'EUR', 'fr'))).toBe('0,07€');
    expect(normalize(formatMinorAmount('-760', 'EUR', 'fr'))).toBe('-7,60€');
    // Au-delà de ce qu'un entier JavaScript représente exactement : c'est le
    // cas que la conversion en nombre perdrait en silence.
    expect(
      normalize(formatMinorAmount('900719925474099100', 'EUR', 'fr')),
    ).toBe('9007199254740991,00€');
  });
});
