import { createHash } from 'node:crypto';

import { hashBucketKey, readBucketHmacSecret } from './bucket-key';

const configured = { LEARNX_BUCKET_HMAC_SECRET: 'server-secret' };

describe('hashBucketKey', () => {
  it('ne produit pas le SHA-256 nu de la valeur', () => {
    // The point of the ticket: an unsalted digest of an IPv4 address is
    // recoverable from a table of the whole 2^32 space.
    const address = 'access-request:ip:203.0.113.7';
    expect(hashBucketKey(address, configured)).not.toBe(
      createHash('sha256').update(address).digest('hex'),
    );
  });

  it('reconnaît la même valeur et distingue deux valeurs', () => {
    expect(hashBucketKey('a', configured)).toBe(hashBucketKey('a', configured));
    expect(hashBucketKey('a', configured)).not.toBe(
      hashBucketKey('b', configured),
    );
  });

  it('change d’empreinte quand le secret change', () => {
    // Rotating the secret invalidates every bucket, which is harmless: windows
    // are hours long and the rows are purged on their window.
    expect(hashBucketKey('a', configured)).not.toBe(
      hashBucketKey('a', { LEARNX_BUCKET_HMAC_SECRET: 'other-secret' }),
    );
  });
});

describe('readBucketHmacSecret', () => {
  it('accepte un secret explicite', () => {
    expect(readBucketHmacSecret(configured)).toBe('server-secret');
  });

  it.each([
    ['NODE_ENV', { NODE_ENV: 'production' }],
    [
      'LEARNX_AI_CONFIG_ENVIRONMENT',
      { LEARNX_AI_CONFIG_ENVIRONMENT: 'production' },
    ],
  ])('refuse un secret absent en production (%s)', (_label, environment) => {
    // A default secret in production is a published key: the same as no key,
    // while looking like protection.
    expect(() => readBucketHmacSecret(environment)).toThrow(
      /LEARNX_BUCKET_HMAC_SECRET/,
    );
  });

  it('retombe sur un secret de développement hors production', () => {
    expect(readBucketHmacSecret({ NODE_ENV: 'test' })).toBeTruthy();
  });
});
