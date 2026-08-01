import { render } from 'preact';

import { App } from '@/app/App';
import '@/styles/index.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('L’élément racine de l’application est introuvable.');
}

render(<App />, root);
