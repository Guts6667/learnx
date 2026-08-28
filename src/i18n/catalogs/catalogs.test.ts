import { describe, expect, it } from 'vitest';

import {
  englishMessages,
  frenchMessages,
  type MessageKey,
} from '@/i18n/catalogs';
import { messageCatalogBaseline } from '@/i18n/catalogs/baseline';
import { mergeCatalogFragments } from '@/i18n/catalogs/merge';
import { translate } from '@/i18n/i18n';

describe('i18n catalogs', () => {
  it('retains the complete bilingual key set', () => {
    const frenchKeys = Object.keys(frenchMessages).sort();
    const englishKeys = Object.keys(englishMessages).sort();

    expect(frenchKeys).toHaveLength(messageCatalogBaseline.keyCount);
    expect(englishKeys).toEqual(frenchKeys);
  });

  it('translates every retained key without a per-key fallback', () => {
    for (const key of Object.keys(frenchMessages) as MessageKey[]) {
      expect(translate('fr', key, { count: 2 })).not.toHaveLength(0);
      expect(translate('en', key, { count: 2 })).not.toHaveLength(0);
    }
  });

  it('rejects duplicate keys while assembling fragments', () => {
    expect(() =>
      mergeCatalogFragments({ duplicate: 'first' }, { duplicate: 'second' }),
    ).toThrow('Duplicate i18n message key: "duplicate".');
  });
});
