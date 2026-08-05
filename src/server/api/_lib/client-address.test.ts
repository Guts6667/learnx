import { getClientAddress } from './client-address';

describe('getClientAddress', () => {
  it('prefers the Vercel address and canonicalizes supported IP formats', () => {
    const request = new Request('https://learnx.example/api/access-requests', {
      headers: {
        'x-forwarded-for': '198.51.100.2',
        'x-vercel-forwarded-for': '[2001:0DB8:0:0::1]:443',
      },
    });

    expect(getClientAddress(request)).toBe('2001:db8::1');
  });

  it('uses only the first valid forwarded IPv4 address', () => {
    const request = new Request('https://learnx.example/api/access-requests', {
      headers: { 'x-forwarded-for': '203.0.113.4, 10.0.0.1' },
    });

    expect(getClientAddress(request)).toBe('203.0.113.4');
  });

  it('uses an anonymous shared bucket for missing or malformed addresses', () => {
    expect(
      getClientAddress(
        new Request('https://learnx.example/api/access-requests'),
      ),
    ).toBe('unknown');
    expect(
      getClientAddress(
        new Request('https://learnx.example/api/access-requests', {
          headers: { 'x-forwarded-for': 'not-an-ip' },
        }),
      ),
    ).toBe('unknown');
  });
});
