import { exercisesApp } from '../../exercises/app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await exercisesApp.fetch(request);
  },
};
