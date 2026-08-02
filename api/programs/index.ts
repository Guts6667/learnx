import { curriculumApp } from './app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await curriculumApp.fetch(request);
  },
};
