import { authApp } from './app';

export default async function session(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
