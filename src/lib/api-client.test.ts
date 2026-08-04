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
      code: 'OFFLINE_REQUEST_NOT_ALLOWED',
      status: 0,
    } satisfies Partial<ApiClientError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse aussi une lecture privée hors ligne sans chargement suspendu', async () => {
    setOnlineStatus(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/lessons/memoire')).rejects.toMatchObject({
      code: 'OFFLINE_REQUEST_NOT_ALLOWED',
      status: 0,
    } satisfies Partial<ApiClientError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
