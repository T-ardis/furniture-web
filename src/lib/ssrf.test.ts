import { describe, it, expect, vi } from 'vitest';
import { normalizeUrl, isBlockedAddress, safeFetch, SsrfError } from './ssrf';

describe('normalizeUrl', () => {
  it('prepends https to a bare domain', () => {
    expect(normalizeUrl('example.com/product/1').href).toBe('https://example.com/product/1');
  });

  it('prepends https to a scheme-relative URL', () => {
    expect(normalizeUrl('//cdn.example.com/a.jpg').href).toBe('https://cdn.example.com/a.jpg');
  });

  it('preserves an explicit http(s) scheme, path and query', () => {
    expect(normalizeUrl('http://example.com/p?x=1').href).toBe('http://example.com/p?x=1');
    expect(normalizeUrl('https://example.com/p?x=1#f').href).toBe('https://example.com/p?x=1#f');
  });

  it('rejects non-http(s) schemes', () => {
    for (const u of ['ftp://example.com/x', 'file:///etc/passwd', 'gopher://x', 'data:text/html,x']) {
      expect(() => normalizeUrl(u)).toThrow(SsrfError);
    }
  });

  it('rejects embedded credentials', () => {
    expect(() => normalizeUrl('http://user:pass@example.com')).toThrow(SsrfError);
    expect(() => normalizeUrl('https://admin@internal.local')).toThrow(SsrfError);
  });

  it('rejects empty / whitespace / missing host', () => {
    expect(() => normalizeUrl('')).toThrow(SsrfError);
    expect(() => normalizeUrl('   ')).toThrow(SsrfError);
    expect(() => normalizeUrl('https://')).toThrow(SsrfError);
  });

  it('rejects a global wildcard host', () => {
    expect(() => normalizeUrl('http://*')).toThrow(SsrfError);
  });
});

describe('isBlockedAddress (IPv4)', () => {
  it('blocks loopback, private, link-local, metadata, reserved, multicast', () => {
    for (const ip of [
      '127.0.0.1', '127.1.2.3',
      '10.0.0.1', '172.16.5.4', '172.31.255.255', '192.168.1.1',
      '169.254.1.1', '169.254.169.254',
      '0.0.0.0', '100.64.0.1',
      '224.0.0.1', '239.255.255.255',
      '240.0.0.1', '255.255.255.255',
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('allows ordinary public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
});

describe('isBlockedAddress (IPv6)', () => {
  it('blocks loopback, unspecified, link-local, ULA, multicast', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it('blocks IPv4-mapped addresses that map to a blocked v4', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
  });

  it('allows public v6 and public IPv4-mapped', () => {
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('isBlockedAddress (invalid)', () => {
  it('fails closed on non-IP input', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
    expect(isBlockedAddress('999.1.1.1')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
  });
});

// Deterministic offline helpers for the IO guard.
function lookupReturning(map: Record<string, string[]>) {
  return vi.fn(async (host: string) => {
    const addrs = map[host];
    if (!addrs) throw new Error('ENOTFOUND');
    return addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  });
}
// node:dns lookup echoes IP literals back.
const literalLookup = vi.fn(async (host: string) => [{ address: host, family: host.includes(':') ? 6 : 4 }]);

function okResponse(body: string, contentType = 'text/html') {
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
}

describe('safeFetch — blocks SSRF targets with no upstream call', () => {
  it('rejects a loopback IP literal and never calls fetch', async () => {
    const fetchImpl = vi.fn();
    await expect(
      safeFetch('http://127.0.0.1/admin', { fetchImpl, lookup: literalLookup }),
    ).rejects.toBeInstanceOf(SsrfError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects the cloud metadata address and never calls fetch', async () => {
    const fetchImpl = vi.fn();
    await expect(
      safeFetch('http://169.254.169.254/latest/meta-data/', { fetchImpl, lookup: literalLookup }),
    ).rejects.toBeInstanceOf(SsrfError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a hostname that resolves to a private IP and never calls fetch', async () => {
    const fetchImpl = vi.fn();
    const lookup = lookupReturning({ 'evil.example.com': ['10.0.0.5'] });
    await expect(
      safeFetch('http://evil.example.com/', { fetchImpl, lookup }),
    ).rejects.toBeInstanceOf(SsrfError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a non-http scheme before any lookup or fetch', async () => {
    const fetchImpl = vi.fn();
    const lookup = vi.fn();
    await expect(
      safeFetch('file:///etc/passwd', { fetchImpl, lookup }),
    ).rejects.toBeInstanceOf(SsrfError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('re-checks every redirect hop and blocks a redirect to metadata', async () => {
    const lookup = lookupReturning({
      'good.example.com': ['93.184.216.34'],
      '169.254.169.254': ['169.254.169.254'],
    });
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('good.example.com')) {
        return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
      }
      throw new Error('should never fetch metadata');
    });
    await expect(
      safeFetch('http://good.example.com/', { fetchImpl, lookup }),
    ).rejects.toBeInstanceOf(SsrfError);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // only the first, safe hop
  });
});

describe('safeFetch — enforces response limits', () => {
  const lookup = lookupReturning({ 'good.example.com': ['93.184.216.34'] });

  it('rejects a disallowed content-type', async () => {
    const fetchImpl = vi.fn(async () => okResponse('<html>', 'application/pdf'));
    await expect(
      safeFetch('http://good.example.com/', {
        fetchImpl,
        lookup,
        allowedContentTypes: ['text/html'],
      }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it('rejects an oversized body (content-length)', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('x', { status: 200, headers: { 'content-type': 'text/html', 'content-length': String(999_999_999) } }),
    );
    await expect(
      safeFetch('http://good.example.com/', { fetchImpl, lookup, maxBytes: 1024 }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it('rejects an oversized streamed body without content-length', async () => {
    const big = 'a'.repeat(5000);
    const fetchImpl = vi.fn(async () => okResponse(big, 'text/html'));
    await expect(
      safeFetch('http://good.example.com/', { fetchImpl, lookup, maxBytes: 1024 }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it('returns the body on a safe, allowed response', async () => {
    const fetchImpl = vi.fn(async () => okResponse('<html>hello</html>', 'text/html; charset=utf-8'));
    const result = await safeFetch('http://good.example.com/page', {
      fetchImpl,
      lookup,
      allowedContentTypes: ['text/html'],
    });
    expect(result.status).toBe(200);
    expect(result.body.toString('utf-8')).toBe('<html>hello</html>');
    expect(result.contentType).toContain('text/html');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows a safe redirect to a safe host', async () => {
    const lookup2 = lookupReturning({
      'a.example.com': ['93.184.216.34'],
      'b.example.com': ['1.1.1.1'],
    });
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('a.example.com')) {
        return new Response(null, { status: 301, headers: { location: 'http://b.example.com/final' } });
      }
      return okResponse('final', 'text/html');
    });
    const result = await safeFetch('http://a.example.com/', { fetchImpl, lookup: lookup2 });
    expect(result.url).toContain('b.example.com/final');
    expect(result.body.toString('utf-8')).toBe('final');
  });
});
