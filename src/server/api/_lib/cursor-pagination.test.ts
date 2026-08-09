import { describe, expect, it } from 'vitest';

import {
  encodeCursor,
  InvalidCursorError,
  parseCursor,
  toCursorPage,
} from './cursor-pagination.js';

const id = '93aa511e-5ab4-4705-99e7-943da6d17b77';

describe('cursor pagination', () => {
  it('round-trips a cursor only in its original scope and context', () => {
    const cursor = encodeCursor('notes', 'user-1:search', {
      id,
      value: '2026-08-09T12:00:00.000Z',
    });

    expect(parseCursor(cursor, 'notes', 'user-1:search')).toEqual({
      id,
      value: '2026-08-09T12:00:00.000Z',
    });
    expect(() => parseCursor(cursor, 'notes', 'user-2:search')).toThrow(
      InvalidCursorError,
    );
  });

  it('returns one bounded page and an opaque continuation cursor', () => {
    const page = toCursorPage(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      2,
      (item) => item.id,
    );

    expect(page).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      nextCursor: 'b',
    });
  });
});
