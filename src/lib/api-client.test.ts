import { apiRequest, ApiClientError } from '@/lib/api-client';

function setOnlineStatus(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('apiRequest offline policy', () => {
  afterEach(() => {
    setOnlineStatus(true);
    vi.unstubAllGlobals();
  });

  it('refuse une mutation hors ligne sans appeler le réseau', async () => {
    setOnlineStatus(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest('/api/notes', { method: 'POST' }),
    ).rejects.toMatchObject({
      code: 'OFFLINE_MUTATION_NOT_ALLOWED',
      status: 0,
    } satisfies Partial<ApiClientError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('autorise une lecture hors ligne pour laisser agir le service worker', async () => {
    setOnlineStatus(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ lesson: { id: 'lesson-1' } }), {
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    await expect(apiRequest('/api/lessons/memoire')).resolves.toEqual({
      lesson: { id: 'lesson-1' },
    });
  });
});
