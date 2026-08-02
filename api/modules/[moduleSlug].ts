import { curriculumApp } from '../programs/app';

export default async function module(request: Request): Promise<Response> {
  return curriculumApp.fetch(request);
}
