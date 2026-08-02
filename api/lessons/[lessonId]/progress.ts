import { progressApp } from '../../progress/app';

export default async function lessonProgress(
  request: Request,
): Promise<Response> {
  return progressApp.fetch(request);
}
