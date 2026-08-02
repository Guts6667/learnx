import { curriculumApp } from './app';

export default async function programs(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
