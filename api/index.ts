import { apiApp } from '../src/server/api/app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await apiApp.fetch(request);
  },
};
