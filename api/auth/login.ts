import { authApp } from './app';

export default async function login(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
