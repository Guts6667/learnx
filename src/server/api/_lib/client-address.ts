import { isIP } from 'node:net';

function stripAddressPort(value: string): string {
  const bracketedIpv6 = /^\[([^\]]+)](?::\d+)?$/.exec(value);

  if (bracketedIpv6?.[1]) {
    return bracketedIpv6[1];
  }

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
  return ipv4WithPort?.[1] ?? value;
}

function canonicalizeAddress(value: string): string | null {
  const address = stripAddressPort(value.trim());
  const version = isIP(address);

  if (version === 4) {
    return address;
  }

  if (version === 6) {
    const hostname = new URL(`http://[${address}]`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  }

  return null;
}

export function getClientAddress(request: Request): string {
  const forwarded =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for');
  const firstAddress = forwarded?.split(',')[0];

  return firstAddress
    ? (canonicalizeAddress(firstAddress) ?? 'unknown')
    : 'unknown';
}
