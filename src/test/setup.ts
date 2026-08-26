import '@testing-library/jest-dom/vitest';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const storage = window[name];
  if (typeof storage?.clear === 'function') return;

  Object.defineProperty(window, name, {
    configurable: true,
    value: createMemoryStorage(),
  });
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');
