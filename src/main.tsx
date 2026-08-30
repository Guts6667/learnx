import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { reportReactError, startErrorReporting } from '@/observability/sentry';
import '@/styles/index.css';

// Before the tree renders, so a failure during the first render is held rather
// than lost. The SDK itself is fetched once the page is idle; see the module.
startErrorReporting();

const root = document.getElementById('app');

if (!root) {
  throw new Error('L’élément racine de l’application est introuvable.');
}

createRoot(root, {
  onCaughtError: reportReactError,
  onRecoverableError: reportReactError,
  onUncaughtError: reportReactError,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
