/**
 * The only module that imports the Sentry SDK.
 *
 * It exists to be a chunk boundary. Reached exclusively through a dynamic
 * import, Rollup emits it as `sentry-client-<hash>.js`, and that stable prefix
 * is what the service worker excludes from the precache and what the bundle
 * budget exempts by name. Naming the chunk through `manualChunks` instead
 * would replace Vite's default splitting and pull every vendor dependency back
 * into the entry — measured at +154 KB on the initial bundle.
 *
 * The integration list is explicit and `defaultIntegrations` is off. That is
 * what makes the chunk 27 KB gzip instead of 154: Sentry's default set reaches
 * replay, feedback and tracing, and a barrel import of the whole namespace
 * defeats tree-shaking entirely. `__SENTRY_DEBUG__` and `__SENTRY_TRACING__`
 * are defined as false in `vite.config.ts`, which strips the debug logging and
 * the tracing machinery at build time.
 */
import {
  breadcrumbsIntegration,
  captureException,
  dedupeIntegration,
  functionToStringIntegration,
  globalHandlersIntegration,
  inboundFiltersIntegration,
  init,
} from '@sentry/react';

export interface SentryClient {
  captureException: typeof captureException;
}

export function initialiseSentry(dsn: string): SentryClient {
  init({
    defaultIntegrations: false,
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      inboundFiltersIntegration(),
      functionToStringIntegration(),
      dedupeIntegration(),
      // Breadcrumbs are the trail leading to an error, and every source here
      // would carry learner content: console arguments, typed input, the URLs
      // of requests. The trail is not worth the data, so only the manual ones
      // remain — and we add none.
      breadcrumbsIntegration({
        console: false,
        dom: false,
        fetch: false,
        history: false,
        xhr: false,
      }),
      globalHandlersIntegration(),
    ],
    sendDefaultPii: false,
  });

  return { captureException };
}
