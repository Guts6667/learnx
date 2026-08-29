import { selectPack, type CreditPack } from './credit-pack-catalogue';

const pack = (overrides: Partial<CreditPack> = {}): CreditPack => ({
  active: true,
  credits: 500n,
  currency: 'EUR',
  key: 'starter',
  label: 'Démarrage',
  priceMinor: 900n,
  ...overrides,
});

describe('selectPack', () => {
  it('retient un pack actif', () => {
    expect(selectPack([pack()], 'starter')).toEqual({
      kind: 'SELECTED',
      pack: pack(),
    });
  });

  it('refuse un pack inactif au lieu de seulement le masquer', () => {
    // Hiding without refusing would let a guessed key buy a price nobody
    // arbitrated.
    expect(selectPack([pack({ active: false })], 'starter')).toEqual({
      kind: 'INACTIVE',
    });
  });

  it('refuse une clé inconnue', () => {
    expect(selectPack([pack()], 'inventé')).toEqual({ kind: 'UNKNOWN' });
  });
});
