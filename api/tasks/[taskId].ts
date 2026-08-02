import { progressApp } from '../progress/app.js';

export default async function taskProgress(
  request: Request,
): Promise<Response> {
  return progressApp.fetch(request);
}
