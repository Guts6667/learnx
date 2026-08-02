import { curriculumApp } from './app.js';

export default async function program(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
