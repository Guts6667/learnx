/**
 * The purchasable packs (V4.5-161).
 *
 * A pack is inactive until an owner decision activates it (V4.5-164/012), and
 * inactive means both invisible and unbuyable. Hiding without refusing would
 * let a guessed key buy a price nobody arbitrated, which is the kind of gap
 * that is only found after someone has used it.
 */

export interface CreditPack {
  active: boolean;
  credits: bigint;
  currency: string;
  key: string;
  label: string;
  priceMinor: bigint;
}

export type PackSelection =
  | { kind: 'SELECTED'; pack: CreditPack }
  | { kind: 'UNKNOWN' }
  | { kind: 'INACTIVE' };

export function selectPack(packs: CreditPack[], key: string): PackSelection {
  const pack = packs.find((candidate) => candidate.key === key);
  if (!pack) return { kind: 'UNKNOWN' };
  // Distinguished from UNKNOWN internally so the log says which happened, and
  // collapsed to one answer at the boundary so a caller cannot enumerate which
  // keys exist.
  if (!pack.active) return { kind: 'INACTIVE' };
  return { kind: 'SELECTED', pack };
}
