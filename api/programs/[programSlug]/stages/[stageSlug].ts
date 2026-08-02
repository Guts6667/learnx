import { curriculumApp } from '../../app';

export default async function stage(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
