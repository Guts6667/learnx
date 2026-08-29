import { splitRefund } from './refund-split';

describe('splitRefund', () => {
  it('reprend tout quand le lot est intact', () => {
    expect(splitRefund({ remainingOnLot: 500n, requested: 500n })).toEqual({
      reclaimed: 500n,
      writtenOff: 0n,
    });
  });

  it('ne reprend que le disponible et passe le reste en perte', () => {
    // A learner refunded after spending must not end up owing credits.
    expect(splitRefund({ remainingOnLot: 200n, requested: 500n })).toEqual({
      reclaimed: 200n,
      writtenOff: 300n,
    });
  });

  it('passe tout en perte quand le lot est épuisé', () => {
    expect(splitRefund({ remainingOnLot: 0n, requested: 500n })).toEqual({
      reclaimed: 0n,
      writtenOff: 500n,
    });
  });

  it('ne reprend jamais plus que demandé', () => {
    // A partial refund must not empty a lot that holds more.
    expect(splitRefund({ remainingOnLot: 500n, requested: 200n })).toEqual({
      reclaimed: 200n,
      writtenOff: 0n,
    });
  });

  it('ne fait rien pour un montant nul ou négatif', () => {
    expect(splitRefund({ remainingOnLot: 500n, requested: 0n })).toEqual({
      reclaimed: 0n,
      writtenOff: 0n,
    });
  });

  it('ne rend jamais un montant négatif à reprendre', () => {
    // A lot whose remaining amount went negative through some other path must
    // not turn a refund into a grant.
    expect(splitRefund({ remainingOnLot: -50n, requested: 100n })).toEqual({
      reclaimed: 0n,
      writtenOff: 100n,
    });
  });
});
