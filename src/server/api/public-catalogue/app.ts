import { Hono } from 'hono';

import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import type { CreditsCatalogueReader } from '../../payments/credits-catalogue-reader.js';

/**
 * `GET /api/public/credit-packs` (V4.5-206).
 *
 * The landing page publishes what a visitor can buy, and a visitor has no
 * session by definition. Rather than loosen `/api/credits/*`, which would put
 * a hole in the guard that V4.5-186 and V4.5-187 exist to keep closed, the
 * public half of the catalogue gets its own route under an explicit `public`
 * prefix, mounted with the other public apps and guarding nothing.
 *
 * It reads through the SAME reader as the authenticated screen. `listActivePacks`
 * is the one definition of what is purchasable — inactive means invisible and
 * unbuyable (V4.5-161), and an owner activation is what changes that
 * (V4.5-164). A second query with its own `where` would be a second place to
 * forget, and the thing forgotten would be a price nobody arbitrated appearing
 * on the public site.
 *
 * The response carries no identifier: no row id, no position, no provider
 * reference. What is left is what a price list is — a name, a number of
 * credits, an amount and its currency — plus the key, which is the name of a
 * public offer and buys nothing without a session.
 */
export interface PublicCatalogueAppOptions {
  catalogue?: CreditsCatalogueReader;
}

async function defaultCatalogue(): Promise<CreditsCatalogueReader> {
  const { createPrismaCreditsCatalogueReader } =
    await import('../../payments/prisma-credits-catalogue-reader.js');
  return createPrismaCreditsCatalogueReader();
}

export function createPublicCatalogueApp(
  options: PublicCatalogueAppOptions = {},
) {
  const app = new Hono();

  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });

  app.get('/api/public/credit-packs', async (context) => {
    const catalogue = options.catalogue ?? (await defaultCatalogue());
    const packs = await catalogue.listActivePacks();

    // The same list for everyone, and it changes when an owner decides — not
    // between two visitors. Five minutes keeps the landing page off the
    // database on every visit without letting an activation wait for a deploy.
    context.header('cache-control', 'public, max-age=300');

    return context.json({
      packs: packs.map((pack) => ({
        // Minor units as decimal strings, as everywhere else in this API: a
        // price through a JSON number is a rounding bug waiting for a large
        // enough amount.
        credits: pack.credits.toString(),
        currency: pack.currency,
        key: pack.key,
        label: pack.label,
        priceMinor: pack.priceMinor.toString(),
      })),
    });
  });

  return app;
}

export const publicCatalogueApp = createPublicCatalogueApp();
