import { adminApp } from './app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await adminApp.fetch(request);
  },
};
