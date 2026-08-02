import { curriculumApp } from '../../app.js';

export default async function stage(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
