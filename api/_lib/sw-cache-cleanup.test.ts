import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

describe('service worker private cache cleanup', () => {
  it('deletes the legacy private cache during activation', async () => {
    const source = await readFile('public/sw-cache-cleanup.js', 'utf8');
    const deleteCache = vi.fn(async () => true);
    let activateListener:
      | ((event: {
          waitUntil(promise: Promise<unknown>): void;
        }) => void)
      | undefined;
    let cleanup: Promise<unknown> | undefined;

    runInNewContext(source, {
      caches: { delete: deleteCache },
      Promise,
      self: {
        addEventListener(
          type: string,
          listener: (event: {
            waitUntil(promise: Promise<unknown>): void;
          }) => void,
        ) {
          if (type === 'activate') activateListener = listener;
        },
      },
    });

    expect(activateListener).toBeTypeOf('function');
    activateListener?.({
      waitUntil(promise) {
        cleanup = promise;
      },
    });
    await cleanup;

    expect(deleteCache).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith('learnx-pedagogy-v1');
  });
});
