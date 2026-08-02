import { calculateProgress } from '@/lib/progress';

describe('calculateProgress', () => {
  it('applique les pondérations des catégories présentes', () => {
    expect(
      calculateProgress([
        { itemProgress: [100, 50], weight: 40 },
        { itemProgress: [100], weight: 10 },
      ]),
    ).toBe(80);
  });

  it('redistribue le poids des catégories absentes', () => {
    expect(
      calculateProgress([
        { itemProgress: [50], weight: 40 },
        { itemProgress: [], weight: 30 },
        { itemProgress: [100], weight: 10 },
      ]),
    ).toBe(60);
  });

  it('borne les valeurs et retourne zéro sans élément suivi', () => {
    expect(
      calculateProgress([
        { itemProgress: [-20, 180], weight: 1 },
        { itemProgress: [], weight: 1 },
      ]),
    ).toBe(50);
    expect(calculateProgress([{ itemProgress: [], weight: 1 }])).toBe(0);
  });
});
