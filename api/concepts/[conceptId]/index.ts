import { conceptsApp } from '../app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await conceptsApp.fetch(request);
  },
};
