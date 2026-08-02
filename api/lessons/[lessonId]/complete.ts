import { progressApp } from '../../progress/app';

export default async function completeLesson(
  request: Request,
): Promise<Response> {
  return progressApp.fetch(request);
}
