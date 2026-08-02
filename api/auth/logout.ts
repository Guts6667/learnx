import { authApp } from './app';

export default async function logout(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
