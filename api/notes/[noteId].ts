import { notesApp } from './app.js';

export default {
  async fetch(request: Request): Promise<Response> {
    return await notesApp.fetch(request);
  },
};
