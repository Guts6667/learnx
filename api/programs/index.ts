import { curriculumApp } from './app.js';

export default async function programs(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
