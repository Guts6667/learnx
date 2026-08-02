import { authApp } from './app';

export default async function register(request: Request): Promise<Response> {
  return authApp.fetch(request);
}
