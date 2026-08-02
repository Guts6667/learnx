import { authApp } from './app.js';

export default async function logout(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
