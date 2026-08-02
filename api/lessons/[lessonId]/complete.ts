import { progressApp } from '../../progress/app.js';

export default async function completeLesson(
  request: Request,
): Promise<Response> {
  return progressApp.fetch(request);
}
