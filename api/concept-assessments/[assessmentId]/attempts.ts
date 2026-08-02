import { conceptAssessmentsApp } from '../app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await conceptAssessmentsApp.fetch(request);
  },
};
