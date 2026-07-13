import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

function proxyReq(url: string | null) {
  const target = url === null
    ? 'http://localhost/api/image-proxy'
    : `http://localhost/api/image-proxy?url=${encodeURIComponent(url)}`;
  return new NextRequest(target);
}

afterEach(() => vi.restoreAllMocks());

describe('GET /api/image-proxy SSRF guard', () => {
  it('rejects the cloud metadata address without any upstream fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked in test'));
    const res = await GET(proxyReq('http://169.254.169.254/latest/meta-data/image.jpg'));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/169\.254|meta-data|localhost|8080|ECONN|stack/i);
  });

  it('rejects localhost without any upstream fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked in test'));
    const res = await GET(proxyReq('http://localhost:9000/internal.png'));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when url is missing', async () => {
    const res = await GET(proxyReq(null));
    expect(res.status).toBe(400);
  });
});
