import { authApp } from './app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await authApp.fetch(request);
  },
};
