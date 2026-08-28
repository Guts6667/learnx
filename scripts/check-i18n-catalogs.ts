import { createHash } from 'node:crypto';

import {
  englishMessages,
  frenchMessages,
  type MessageValue,
} from '../src/i18n/catalogs.ts';
import { messageCatalogBaseline } from '../src/i18n/catalogs/baseline.ts';

function placeholders(value: MessageValue): string[] {
  const messages =
    typeof value === 'string' ? [value] : [value.one, value.other];
  return [
    ...new Set(
      messages.flatMap((message) =>
        [...message.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(
          (match) => match[1],
        ),
      ),
    ),
  ].sort();
}

function assertCatalogsMatch(): void {
  const frenchKeys = Object.keys(frenchMessages).sort();
  const englishKeys = Object.keys(englishMessages).sort();

  if (JSON.stringify(frenchKeys) !== JSON.stringify(englishKeys)) {
    throw new Error(
      'The French and English catalogs do not have the same keys.',
    );
  }

  if (frenchKeys.length !== messageCatalogBaseline.keyCount) {
    throw new Error(
      `Expected ${messageCatalogBaseline.keyCount} messages, found ${frenchKeys.length}.`,
    );
  }

  for (const key of frenchKeys) {
    const typedKey = key as keyof typeof frenchMessages;
    const frenchValue = frenchMessages[typedKey] as MessageValue;
    const englishValue = englishMessages[typedKey] as MessageValue;

    if (typeof frenchValue !== typeof englishValue) {
      throw new Error(`Message kind differs for key "${key}".`);
    }

    if (
      JSON.stringify(placeholders(frenchValue)) !==
      JSON.stringify(placeholders(englishValue))
    ) {
      throw new Error(`Message placeholders differ for key "${key}".`);
    }

    const frenchValues =
      typeof frenchValue === 'string'
        ? [frenchValue]
        : [frenchValue.one, frenchValue.other];
    const englishValues =
      typeof englishValue === 'string'
        ? [englishValue]
        : [englishValue.one, englishValue.other];
    const values = [...frenchValues, ...englishValues];
    if (values.some((value) => value.trim().length === 0)) {
      throw new Error(`Message "${key}" contains an empty translation.`);
    }
  }

  const catalogs = {
    en: englishMessages,
    fr: frenchMessages,
  } as const;

  for (const locale of ['en', 'fr'] as const) {
    const canonicalCatalog = JSON.stringify(
      Object.fromEntries(
        Object.entries(catalogs[locale]).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    const digest = createHash('sha256').update(canonicalCatalog).digest('hex');
    if (digest !== messageCatalogBaseline.sha256[locale]) {
      throw new Error(
        `The ${locale} catalog differs from the V4.1-404 baseline (${digest}).`,
      );
    }
  }
}

assertCatalogsMatch();
console.log(
  `i18n catalogs are aligned: ${Object.keys(frenchMessages).length} keys in fr and en.`,
);
