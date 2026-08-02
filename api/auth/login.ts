import { authApp } from './app.js';

export default async function login(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
