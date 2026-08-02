import { quizzesApp } from '../app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await quizzesApp.fetch(request);
  },
};
