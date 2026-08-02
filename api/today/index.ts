import { todayApp } from './app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await todayApp.fetch(request);
  },
};
