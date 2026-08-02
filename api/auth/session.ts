import { authApp } from './app.js';

export default async function session(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
