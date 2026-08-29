import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

describe('service worker cache cleanup', () => {
  it('deletes private and obsolete public caches during activation', async () => {
    const source = await readFile('public/sw-cache-cleanup.js', 'utf8');
    const deleteCache = vi.fn(async () => true);
    let activateListener:
      | ((event: { waitUntil(promise: Promise<unknown>): void }) => void)
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

    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith('learnx-pedagogy-v1');
    expect(deleteCache).toHaveBeenCalledWith('learnx-public-shell-v0');
  });
});
