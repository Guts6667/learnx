import { curriculumApp } from '../programs/app';

export default async function lesson(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
