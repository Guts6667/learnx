import { describe, expect, it, vi } from 'vitest';

import { processCursorBatches } from './cursor-batches.js';

describe('cursor batches', () => {
  it('processes bounded pages without retaining or skipping a record', async () => {
    const pages = new Map<string | undefined, Array<{ id: string }>>([
      [undefined, [{ id: 'a' }, { id: 'b' }]],
      ['b', [{ id: 'c' }]],
      ['c', []],
    ]);
    const fetchBatch = vi.fn(
      async (cursor: string | undefined) => pages.get(cursor) ?? [],
    );
    const processed: string[] = [];

    await expect(
      processCursorBatches({
        fetchBatch,
        processRecord: async (record) => {
          processed.push(record.id);
        },
      }),
    ).resolves.toBe(3);
    expect(fetchBatch.mock.calls).toEqual([[undefined], ['b'], ['c']]);
    expect(processed).toEqual(['a', 'b', 'c']);
  });
});
