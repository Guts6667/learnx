import { describe, expect, it } from 'vitest';

import { pwaNavigateFallbackDenylist } from '@/lib/pwa-navigation';

function isDeniedFromPwaFallback(pathname: string): boolean {
  return pwaNavigateFallbackDenylist.some((pattern) => pattern.test(pathname));
}

describe('public static navigation', () => {
  it('keeps both research reports outside the Preact navigation fallback', () => {
    expect(isDeniedFromPwaFallback('/research/ai-correction/')).toBe(true);
    expect(isDeniedFromPwaFallback('/research/ai-correction/en.html')).toBe(
      true,
    );
    expect(
      isDeniedFromPwaFallback(
        '/research/ai-correction/evidence-assist-gate-4/',
      ),
    ).toBe(true);
    expect(
      isDeniedFromPwaFallback(
        '/research/ai-correction/evidence-assist-gate-4/en.html',
      ),
    ).toBe(true);
    expect(isDeniedFromPwaFallback('/today')).toBe(false);
    expect(isDeniedFromPwaFallback('/program/example')).toBe(false);
  });
});
