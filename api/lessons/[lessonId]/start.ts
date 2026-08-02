import { progressApp } from '../../progress/app.js';

export default async function startLesson(request: Request): Promise<Response> {
  return progressApp.fetch(request);
}
