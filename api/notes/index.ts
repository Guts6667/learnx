import { handle } from 'hono/vercel';

import { notesApp } from './app.js';

export default handle(notesApp);
