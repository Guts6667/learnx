const PRIVATE_STORAGE_PREFIX = 'learnx:';

function removePrivateEntries(storage: Storage): void {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key?.startsWith(PRIVATE_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

export function purgePrivateBrowserStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    removePrivateEntries(window.localStorage);
  } catch {
    // Storage can be unavailable in private or hardened browser contexts.
  }

  try {
    removePrivateEntries(window.sessionStorage);
  } catch {
    // Storage can be unavailable in private or hardened browser contexts.
  }
}
