import { curriculumApp } from '../programs/app.js';

export default async function module(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
