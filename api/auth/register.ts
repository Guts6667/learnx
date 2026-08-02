import { authApp } from './app.js';

export default async function register(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
