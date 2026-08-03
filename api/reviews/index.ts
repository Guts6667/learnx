import { handle } from 'hono/vercel';

import { reviewsApp } from './app.js';

export default handle(reviewsApp);
