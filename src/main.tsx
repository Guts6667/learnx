import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import '@/styles/index.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('L’élément racine de l’application est introuvable.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
