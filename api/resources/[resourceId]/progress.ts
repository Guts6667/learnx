import { progressApp } from '../../progress/app.js';

export default async function resourceProgress(
  request: Request,
): Promise<Response> {
  return progressApp.fetch(request);
}
