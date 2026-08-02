import { progressApp } from '../../progress/app';

export default async function resourceProgress(
  request: Request,
): Promise<Response> {
  return progressApp.fetch(request);
}
