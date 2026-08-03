import { reviewsApp } from './app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await reviewsApp.fetch(request);
  },
};
