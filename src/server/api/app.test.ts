import { apiApp } from './app';

describe('consolidated Vercel API', () => {
  it('exposes the authentication routes through the single entry point', async () => {
    const response = await apiApp.request('/api/auth/session');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ user: null });
  });

  it('keeps unknown protected routes behind authentication', async () => {
    const response = await apiApp.request('/api/unknown');

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
