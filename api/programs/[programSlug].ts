import { curriculumApp } from './app';

export default async function program(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
