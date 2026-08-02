import { progressApp } from '../progress/app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await progressApp.fetch(request);
  },
};
