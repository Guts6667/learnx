import { progressApp } from '../../progress/app';

export default async function startLesson(request: Request): Promise<Response> {
  return progressApp.fetch(request);
}
